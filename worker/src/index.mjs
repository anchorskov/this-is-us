import { Router } from 'itty-router';
import { getSafeOrigin, validateCoords, isLocalEnv } from './utils/helpers.mjs';
const router = Router();

function getEnvBindings(env, request) {
  const host = (request.headers.get('host') || '').toLowerCase();
  const isLocal = host.includes('localhost') || host.startsWith('127.');
  return {
    db: isLocal ? env.EVENTS_DB_PREVIEW : env.EVENTS_DB,
    r2: isLocal ? env.EVENT_PDFS_PREVIEW : env.EVENT_PDFS
  };
}

// Serve PDF
router.get('/api/events/pdf/:key', async (request, env) => {
  const { key } = request.params;
  const { r2 } = getEnvBindings(env, request);
  const obj = await r2.get(key, { allowScripting: true });
  if (!obj) {
    return new Response(JSON.stringify({ error: 'PDF not found', code: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': obj.httpMetadata.contentType || 'application/pdf',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
});

// Fetch Events
router.get('/api/events', async (request, env) => {
  const { db } = getEnvBindings(env, request);
  const { results } = await db.prepare(`
    SELECT id, name, date, location, pdf_url, lat, lng
    FROM events
    WHERE date >= date('now')
    ORDER BY date
  `).all();
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Debug
router.get('/_debug/schema', async (request, env) => {
  const { db } = getEnvBindings(env, request);
  const { results } = await db.prepare(`PRAGMA table_info(events)`).all();
  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
});

// Create Event
router.post('/api/events/create', async (request, env) => {
  const form = await request.formData();
  const { db, r2 } = getEnvBindings(env, request);

  const userId       = form.get('userId') ?? form.get('user_id') ?? 'anonymous';
  const name         = form.get('name');
  const date         = form.get('date');
  const location     = form.get('location');
  const file         = form.get('file');
  const description  = form.get('description') ?? '';
  const sponsor      = form.get('sponsor') ?? '';
  const contactEmail = form.get('contactEmail') ?? form.get('contact_email') ?? '';
  const contactPhone = form.get('contactPhone') ?? form.get('contact_phone') ?? '';

  const { lat, lng } = validateCoords(form.get('lat'), form.get('lng'));

  // 🔍 Check required fields
  if (!name || !date || !location || !file) {
    return new Response(JSON.stringify({
      error: 'Missing required fields.',
      code: 'missing_fields'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const buffer   = await file.arrayBuffer();
    const hashBuf  = await crypto.subtle.digest('SHA-256', buffer);
    const pdf_hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    let pdf_url;
    const { results: dup } = await db.prepare(
      `SELECT pdf_url FROM events WHERE pdf_hash = ? LIMIT 1`
    ).bind(pdf_hash).all();

    if (dup.length) {
  console.warn("⚠️ Reusing existing PDF for new event");
  pdf_url = dup[0].pdf_url;
} else {
  const key = `event-${crypto.randomUUID()}.pdf`;
  await r2.put(key, file.stream());

// ✅ Strip trailing slash to avoid double slashes in URL
const origin = getSafeOrigin(request).replace(/\/$/, '');
pdf_url = `${origin}/api/events/pdf/${key}`;
}

    await db.prepare(`
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

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("❌ Internal error:", err);
    return new Response(JSON.stringify({
      error: 'Internal error occurred',
      code: 'internal_error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

router.all('*', () => new Response('Not found', { status: 404 }));

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
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
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  },

  async scheduled(event, env, ctx) {
    const db = env.EVENTS_DB;
    const r2 = env.EVENT_PDFS;
    const { results: expiredEvents } = await db.prepare(
      `SELECT id, pdf_url FROM events WHERE date < date('now','-1 day')`
    ).all();

    for (const ev of expiredEvents) {
      try {
        const url = new URL(ev.pdf_url);
        const key = url.pathname.split('/').slice(2).join('/');
        await r2.delete(key);
      } catch (e) {
        console.error(`🧨 Failed to delete expired event asset:`, e);
      }
    }

    await db.prepare(`DELETE FROM events WHERE date < date('now','-1 day')`).run();
  }
};
