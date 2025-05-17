import { Router } from 'itty-router';
const router = Router();

// Serve PDF files via Worker to avoid cross-origin issues
router.get('/api/events/pdf/:key', async (request, env) => {
  const { key } = request.params;
  const obj = await env.EVENT_PDFS.get(key, { allowScripting: true });

  if (!obj) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': obj.httpMetadata.contentType || 'application/pdf',
      'Content-Disposition': `inline; filename="${key}"`,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
});

// List future events for display
router.get('/api/events', async (request, env) => {
  const { results } = await env.EVENTS_DB.prepare(`
    SELECT id, name, date, location, pdf_key, lat, lng
    FROM events
    WHERE date >= date('now')
    ORDER BY date
  `).all();

  const origin = new URL(request.url).origin;
  const events = results.map(ev => ({
    id: ev.id,
    name: ev.name,
    date: ev.date,
    location: ev.location,
    lat: ev.lat,
    lng: ev.lng,
    pdf_url: `${origin}/api/events/pdf/${ev.pdf_key}`
  }));

  return new Response(JSON.stringify(events), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// Debug endpoint: see table schema
router.get('/api/_debug/schema', async (_, env) => {
  const { results } = await env.EVENTS_DB.prepare(`PRAGMA table_info(events)`).all();
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// Create a new event
router.post('/api/events/create', async (request, env) => {
  const form = await request.formData();

  const userId        = form.get('userId')        ?? form.get('user_id')        ?? 'anonymous';
  const name          = form.get('name');
  const date          = form.get('date');
  const location      = form.get('location');
  const file          = form.get('file');
  const description   = form.get('description')   || '';
  const lat           = form.get('lat');
  const lng           = form.get('lng');
  const sponsor       = form.get('sponsor')       || '';
  const contactEmail  = form.get('contactEmail')  ?? form.get('contact_email')  ?? '';
  const contactPhone  = form.get('contactPhone')  ?? form.get('contact_phone')  ?? '';

  console.log("📝 Incoming event submission:", {
    userId, name, date, location, lat, lng,
    description, sponsor, contactEmail, contactPhone,
    file: file?.name
  });

  if (!name || !date || !location || !file) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!(file && file.arrayBuffer)) {
    return new Response(JSON.stringify({ error: 'Invalid file' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Compute file hash for deduplication
    const buffer = await file.arrayBuffer();
    const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
    const pdf_hash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Check for existing PDF by hash
    const { results: existing } = await env.EVENTS_DB.prepare(
      `SELECT pdf_key FROM events WHERE pdf_hash = ?`
    ).bind(pdf_hash).all();

    let key;
    if (existing.length > 0) {
      key = existing[0].pdf_key;
      console.log(`🔁 Duplicate PDF detected, reusing key ${key}`);
    } else {
      key = `event-${crypto.randomUUID()}.pdf`;
      await env.EVENT_PDFS.put(key, file.stream());
      console.log(`📄 Uploaded new PDF: ${key}`);
    }

    // Rebuild the public URL from origin
    const origin = new URL(request.url).origin;
    const pdf_url = `${origin}/api/events/pdf/${key}`;

    // Insert the event record (store only the key)
    await env.EVENTS_DB.prepare(`
      INSERT INTO events (
        user_id, name, date, location,
        pdf_key, lat, lng, sponsor,
        contact_email, contact_phone,
        pdf_hash, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId, name, date, location,
      key, lat, lng, sponsor,
      contactEmail, contactPhone,
      pdf_hash, description
    ).run();

    console.log("✅ Event successfully saved to database");

    const { results } = await env.EVENTS_DB.prepare(
      `SELECT last_insert_rowid() AS lastInsertRowid`
    ).all();
    const lastInsertRowid = results?.[0]?.lastInsertRowid || null;

    return new Response(JSON.stringify({ success: true, id: lastInsertRowid }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("❌ Error submitting event:", err.stack || err.message || err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Fallback for unmatched routes
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
    Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  },

  async scheduled(event, env, ctx) {
    // Clean up expired events
    const { results: expiredEvents } = await env.EVENTS_DB.prepare(
      `SELECT id, pdf_key FROM events WHERE date < date('now','-1 day')`
    ).all();

    for (const ev of expiredEvents) {
      try {
        await env.EVENT_PDFS.delete(ev.pdf_key);
      } catch (e) {
        console.error(`🧨 Failed to delete expired event asset ID ${ev.id}:`, e);
      }
    }

    await env.EVENTS_DB.prepare(
      `DELETE FROM events WHERE date < date('now','-1 day')`
    ).run();
  }
};
