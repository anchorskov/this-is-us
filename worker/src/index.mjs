/* worker/src/index.mjs -------------------------------------------------- */
/* Cloudflare Worker (events, PDFs, Town-Hall, sandbox)                    */

import { Router }                     from 'itty-router';
import { handleSandboxAnalyze }       from './routes/sandbox.js';
import { handleCreateTownhallPost }   from './townhall/createPost.js';
import { handleListTownhallPosts }    from './townhall/listPosts.js';
import { handleDeleteTownhallPost }   from './townhall/deletePost.js';

const router = Router();

/* ────────────────────────────  Health probe  ─────────────────────────── */
router.get('/api/_health', () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
);

/* ────────────────────────────  PDF proxy  ────────────────────────────── */
router.get('/api/events/pdf/:key', async ({ params }, env) => {
  const obj = await env.EVENT_PDFS.get(params.key, { allowScripting: true });
  if (!obj)
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });

  return new Response(obj.body, {
    headers: {
      'Content-Type'     : obj.httpMetadata.contentType || 'application/pdf',
      'Content-Disposition': `inline; filename="${params.key}"`,
      'Cache-Control'    : 'public, max-age=31536000',
    },
  });
});

/* ───────────────────────  GET /api/events  (future)  ─────────────────── */
router.get('/api/events', async (request, env) => {
  const { results } = await env.EVENTS_DB.prepare(`
    SELECT id,name,date,location,pdf_key,lat,lng
      FROM events
      WHERE date >= date('now')
      ORDER BY date
  `).all();

  const origin = new URL(request.url).origin;
  return new Response(
    JSON.stringify(results.map(e => ({ ...e, pdf_url: `${origin}/api/events/pdf/${e.pdf_key}` }))),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

/* ────────────────────────  GET /api/_debug/schema  ───────────────────── */
router.get('/api/_debug/schema', async (_, env) => {
  const { results } = await env.EVENTS_DB.prepare(`PRAGMA table_info(events)`).all();
  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
});

/* ───────────────────────  POST /api/events/create  ───────────────────── */
router.post('/api/events/create', async (request, env) => {
  const fd = await request.formData();

  /* required + optional fields */
  const userId       = fd.get('userId') ?? fd.get('user_id') ?? 'anonymous';
  const name         = fd.get('name');
  const date         = fd.get('date');
  const location     = fd.get('location');
  const lat          = fd.get('lat');
  const lng          = fd.get('lng');
  const description  = fd.get('description') ?? '';
  const sponsor      = fd.get('sponsor') ?? '';
  const contactEmail = fd.get('contactEmail') ?? fd.get('contact_email') ?? '';
  const contactPhone = fd.get('contactPhone') ?? fd.get('contact_phone') ?? '';
  const file         = fd.get('file');                       // may be null

  if (!name || !date || !location)
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });

  /* optional flyer upload (dedupe by SHA-256) */
  const MAX_SIZE = 5 * 1024 * 1024;
  let pdf_key = null, pdf_hash = null;

  if (file instanceof File) {
    if (file.size > MAX_SIZE)
      return new Response(JSON.stringify({ error: 'File too large (max 5 MB)' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });

    const buf  = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    pdf_hash   = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');

    /* if local DB is old, pdf_hash column may be missing → ignore dedupe */
    let dedupeSupported = true;
    try {
      await env.EVENTS_DB.prepare('SELECT pdf_key FROM events WHERE pdf_hash = ? LIMIT 1')
                          .bind(pdf_hash).all();
    } catch { dedupeSupported = false; }

    if (dedupeSupported) {
      const { results: dup } = await env.EVENTS_DB
        .prepare('SELECT pdf_key FROM events WHERE pdf_hash = ?')
        .bind(pdf_hash).all();

      if (dup.length) pdf_key = dup[0].pdf_key;
    }

    if (!pdf_key) {
      pdf_key = `event-${crypto.randomUUID()}.pdf`;
      await env.EVENT_PDFS.put(pdf_key, file.stream());
    }
  }

  /* insert */
  await env.EVENTS_DB.prepare(`
      INSERT INTO events (
        user_id,name,date,location,
        pdf_key,lat,lng,sponsor,
        contact_email,contact_phone,
        pdf_hash,description
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    userId,name,date,location,
    pdf_key,lat,lng,sponsor,
    contactEmail,contactPhone,
    pdf_hash,description
  ).run();

  const { results } = await env.EVENTS_DB.prepare('SELECT last_insert_rowid() AS id').all();
  return new Response(JSON.stringify({ success: true, id: results?.[0]?.id }), {
    status: 201, headers: { 'Content-Type': 'application/json' }
  });
});

/* ────────────────  Town-Hall & Sandbox sub-routes  ───────────────────── */
router.post('/api/townhall/create', handleCreateTownhallPost);
router.get ('/api/townhall/posts',  handleListTownhallPosts);
router.post('/api/townhall/delete', handleDeleteTownhallPost);
router.post('/api/sandbox/analyze', handleSandboxAnalyze);

/* fallback */
router.all('*', () => new Response('Not found', { status: 404 }));

/* ───────────────────────  Worker export  ─────────────────────────────── */
export default {
  async fetch(request, env, ctx) {
    /* CORS */
    const cors = {
      'Access-Control-Allow-Origin' : request.headers.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const res  = await router.fetch(request, env, ctx);
    const hdrs = new Headers(res.headers);
    Object.entries(cors).forEach(([k, v]) => hdrs.set(k, v));
    return new Response(res.body, { status: res.status, headers: hdrs });
  },

  /* nightly cleanup */
  async scheduled(_, env) {
    const { results } = await env.EVENTS_DB.prepare(`
      SELECT pdf_key FROM events WHERE date < date('now','-1 day')
    `).all();

    for (const { pdf_key } of results)
      try   { await env.EVENT_PDFS.delete(pdf_key); }
      catch (e) { console.error('🧨 failed to delete', pdf_key, e); }

    await env.EVENTS_DB.prepare(`
      DELETE FROM events WHERE date < date('now','-1 day')
    `).run();
  },
};
