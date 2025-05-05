import { Router } from 'itty-router';
const router = Router();

// GET /api/events
router.get('/api/events', async (request, env) => {
  const { results } = await env.EVENTS_DB.prepare(
    `SELECT id, name, date, location, pdf_url
       FROM events
      WHERE date >= date('now')
      ORDER BY date`
  ).all();
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// POST /api/events/create
router.post('/api/events/create', async (request, env) => {
  const form     = await request.formData();
  const name     = form.get('name');
  const date     = form.get('date');
  const location = form.get('location');
  const file     = form.get('file');

  if (!name || !date || !location || !file) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
  }

  // Upload PDF to R2
  const key = `event-${crypto.randomUUID()}.pdf`;
  await env.EVENT_PDFS.put(key, file.stream());
  const pdf_url = `https://${env.EVENT_PDFS.accountId}.r2.cloudflarestorage.com/${env.EVENT_PDFS.bucketName}/${key}`;

  // Insert into D1
  await env.EVENTS_DB.prepare(
    `INSERT INTO events (user_id, name, date, location, pdf_url)
     VALUES (?, ?, ?, ?, ?)`
  )
  .bind(1, name, date, location, pdf_url)
  .run();

  return new Response(JSON.stringify({ success: true }), { status: 201 });
});

// 404 fallback
router.all('*', () => new Response('Not found', { status: 404 }));

export default {
  // HTTP entrypoint
  async fetch(request, env, ctx) {
    return router.fetch(request, env, ctx);
  },

  // Cron entrypoint with R2 cleanup and DB cleanup
  async scheduled(event, env, ctx) {
    // Find expired events (older than 1 day after the event)
    const { results: expiredEvents } = await env.EVENTS_DB.prepare(
      `SELECT id, pdf_url FROM events WHERE date < date('now','-1 day')`
    ).all();

    // Delete associated PDFs from R2
    for (const ev of expiredEvents) {
      try {
        const url = new URL(ev.pdf_url);
        // URL path is /<bucket>/<key>
        const parts = url.pathname.split('/');
        const key = parts.slice(2).join('/');
        await env.EVENT_PDFS.delete(key);
      } catch (e) {
        console.error(`Failed to delete PDF for event ID ${ev.id}:`, e);
      }
    }

    // Remove expired events from the database
    await env.EVENTS_DB.prepare(
      `DELETE FROM events WHERE date < date('now','-1 day')`
    ).run();
  }
};
