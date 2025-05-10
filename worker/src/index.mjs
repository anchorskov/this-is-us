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
  const form = await request.formData();
  const name = form.get('name');
  const date = form.get('date');
  const location = form.get('location');
  const file = form.get('file');
  const description = form.get('description') || '';
  const userId = form.get('userId') || 'anonymous';
  const lat = form.get('lat');
  const lng = form.get('lng');
  const sponsor = form.get('sponsor') || '';
  const contact_email = form.get('contact_email') || '';
  const contact_phone = form.get('contact_phone') || '';

  console.log("📝 Incoming event submission:", {
    userId, name, date, location, description, lat, lng, sponsor, contact_email, contact_phone,
    file: file ? file.name : "No file"
  });

  if (!name || !date || !location || !file) {
    console.warn("⚠️ Missing required fields", { name, date, location, file });
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
  }

  try {
    const key = `event-${crypto.randomUUID()}.pdf`;
    await env.EVENT_PDFS.put(key, file.stream());
    const pdf_url = `https://${env.EVENT_PDFS.accountId}.r2.cloudflarestorage.com/${env.EVENT_PDFS.bucketName}/${key}`;

    console.log(`📄 PDF uploaded to R2: ${pdf_url}`);

    await env.EVENTS_DB.prepare(
      `INSERT INTO events (
        user_id, name, date, location, pdf_url, lat, lng,
        sponsor, contact_email, contact_phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      userId, name, date, location, pdf_url, lat, lng,
      sponsor, contact_email, contact_phone
    ).run();

    console.log("✅ Event saved to database");

    return new Response(JSON.stringify({ success: true }), { status: 201 });
  } catch (err) {
    console.error("❌ Error submitting event:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

// 404 fallback
router.all('*', () => new Response('Not found', { status: 404 }));

export default {
  async fetch(request, env, ctx) {
    return router.fetch(request, env, ctx);
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
