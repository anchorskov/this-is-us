import { Router } from 'itty-router';
const router = Router();

// Helper: geocode an address via Nominatim
async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  if (!data.length) throw new Error('Address not found');
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon)
  };
}

// GET /api/events
router.get('/api/events', async (request, env) => {
  const { results } = await env.EVENTS_DB.prepare(
    `SELECT id, sponsor, contact_email, contact_phone, name, date, location, pdf_url, lat, lng
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
  const sponsor  = form.get('sponsor');
  const email    = form.get('email');
  const phone    = form.get('phone');
  const name     = form.get('name');
  const date     = form.get('date');
  const street   = form.get('street');
  const city     = form.get('city');
  const state    = form.get('state');
  const zip      = form.get('zip');
  const file     = form.get('file');

  if (!sponsor || !email || !phone || !name || !date || !street || !city || !state || !zip || !file) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
  }

  // Compose full address
  const location = `${street}, ${city}, ${state} ${zip}`;

  // Geocode to get lat/lng
  let lat, lng;
  try {
    ({ lat, lng } = await geocodeAddress(location));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }

  // Upload PDF to R2
  const key = `event-${crypto.randomUUID()}.pdf`;
  await env.EVENT_PDFS.put(key, file.stream());
  const pdf_url = `https://${env.EVENT_PDFS.accountId}.r2.cloudflarestorage.com/${env.EVENT_PDFS.bucketName}/${key}`;

  // Insert into D1
  await env.EVENTS_DB.prepare(
    `INSERT INTO events
       (user_id, sponsor, contact_email, contact_phone,
        name, date, location, pdf_url, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  .bind(
    1,
    sponsor,
    email,
    phone,
    name,
    date,
    location,
    pdf_url,
    lat,
    lng
  )
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
    // Find expired events
    const { results: expiredEvents } = await env.EVENTS_DB.prepare(
      `SELECT id, pdf_url FROM events WHERE date < date('now','-1 day')`
    ).all();

    // Delete associated PDFs from R2
    for (const ev of expiredEvents) {
      try {
        const url = new URL(ev.pdf_url);
        const parts = url.pathname.split('/');
        const key = parts.slice(2).join('/');
        await env.EVENT_PDFS.delete(key);
      } catch (e) {
        console.error(`Failed to delete PDF for event ID ${ev.id}:`, e);
      }
    }

    // Remove expired events
    await env.EVENTS_DB.prepare(
      `DELETE FROM events WHERE date < date('now','-1 day')`
    ).run();
  }
};
