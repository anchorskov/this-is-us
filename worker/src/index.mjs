// worker/src/index.mjs

import { Router } from 'itty-router';
const router = Router();

// Serve PDF files via Worker to avoid cross-origin issues
router.get('/api/events/pdf/:key', async (request, env) => {
  const { key } = request.params;
  const obj = await env.EVENT_PDFS.get(key, { allowScripting: true });
  if (!obj) return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': obj.httpMetadata.contentType || 'application/pdf',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
});

// GET /api/events - include lat & lng for mapping
router.get('/api/events', async (request, env) => {
  const { results } = await env.EVENTS_DB.prepare(
    `SELECT id, name, date, location, pdf_url, lat, lng
     FROM events
     WHERE date >= date('now')
     ORDER BY date`
  ).all();
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Debug schema
router.get('/_debug/schema', async (_, env) => {
  const { results } = await env.EVENTS_DB.prepare(`PRAGMA table_info(events)`).all();
  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
});

// POST /api/events/create - handles event creation
router.post('/api/events/create', async (request, env) => {
  const form = await request.formData();

  // accept either camelCase or snake_case field names
  const userId        = form.get('userId')            ?? form.get('user_id')            ?? 'anonymous';
  const name          = form.get('name');
  const date          = form.get('date');
  const location      = form.get('location');
  const file          = form.get('file');
  const description   = form.get('description')       || '';
  const lat           = form.get('lat');
  const lng           = form.get('lng');
  const sponsor       = form.get('sponsor')           || '';
  const contactEmail  = form.get('contactEmail') ?? form.get('contact_email') ?? '';
  const contactPhone  = form.get('contactPhone') ?? form.get('contact_phone') ?? '';

  console.log("📝 Incoming event submission:", {
    userId, name, date, location, lat, lng,
    description, sponsor, contactEmail, contactPhone,
    file: file?.name
  });

  if (!name || !date || !location || !file) {
    console.warn("⚠️ Missing required fields", { name, date, location, file });
    return new Response(JSON.stringify({ error: 'Missing fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Compute SHA‑256 hash of the PDF for deduplication
    const buffer   = await file.arrayBuffer();
    const hashBuf  = await crypto.subtle.digest('SHA-256', buffer);
    const pdf_hash = Array.from(new Uint8Array(hashBuf))
                         .map(b => b.toString(16).padStart(2, '0'))
                         .join('');

// Check for duplicate PDF only in production (skip on localhost or 127.x)
const host = (request.headers.get('host') || '').toLowerCase();
const isLocal = host.includes('localhost') || host.startsWith('127.');

console.log("🌐 Host header:", host);
console.log("🧪 isLocal environment:", isLocal);

if (!isLocal) {
  const { results: dup } = await env.EVENTS_DB.prepare(
    `SELECT id FROM events WHERE pdf_hash = ?`
  ).bind(pdf_hash).all();

  if (dup.length) {
    console.warn("⚠️ Duplicate PDF detected, aborting upload", { pdf_hash });
    return new Response(JSON.stringify({
      error: 'Duplicate PDF',
      duplicate: true
    }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}


    // Upload to R2
    const key = `event-${crypto.randomUUID()}.pdf`;
    await env.EVENT_PDFS.put(key, file.stream());
    const origin = new URL(request.url).origin;
    const pdf_url = `${origin}/api/events/pdf/${key}`;

    console.log(`📄 PDF uploaded, accessible at: ${pdf_url}`);

    // Insert into D1 with coordinates
    await env.EVENTS_DB.prepare(`
      INSERT INTO events (
        user_id, name, date, location, pdf_url,
        lat, lng, sponsor, contact_email,
        contact_phone, pdf_hash, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId, name, date, location, pdf_url,
      lat, lng, sponsor, contactEmail,
      contactPhone, pdf_hash, description
    ).run();

    console.log("✅ Event saved to database");

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error("❌ Error submitting event:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// 404 fallback
router.all('*', () => new Response('Not found', { status: 404 }));

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin':  request.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const response = await router.fetch(request, env, ctx);
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, val]) => newHeaders.set(key, val));

    return new Response(response.body, {
      status:     response.status,
      statusText: response.statusText,
      headers:    newHeaders
    });
  },

  async scheduled(event, env, ctx) {
    const { results: expiredEvents } = await env.EVENTS_DB.prepare(
      `SELECT id, pdf_url FROM events WHERE date < date('now','-1 day')`
    ).all();

    for (const ev of expiredEvents) {
      try {
        const url = new URL(ev.pdf_url);
        const key = url.pathname.split('/').slice(2).join('/');
        await env.EVENT_PDFS.delete(key);
      } catch (e) {
        console.error(`🧨 Failed to delete R2 asset for expired event ID ${ev.id}:`, e);
      }
    }

    await env.EVENTS_DB.prepare(
      `DELETE FROM events WHERE date < date('now','-1 day')`
    ).run();
  }
};
