// worker/src/routes/events.js
// ⬆️ Relative path: worker/src/routes/events.js

import { handleCORSPreflight, corsHeaders } from '../utils/cors.js';

const PDF_BASE_URL = 'https://this-is-us.org/api/events/pdf';

// --- Handler for GET /api/events ---
export async function handleListEvents(request, env) {
  const cors = handleCORSPreflight(request);
  if (cors) return cors;

  const { results } = await env.EVENTS_DB.prepare(
    `SELECT id, name, date, location, pdf_key, lat, lng
     FROM events
     WHERE date >= date('now')
     ORDER BY date`
  ).all();

  return new Response(
    JSON.stringify(results.map(e => ({ ...e, pdf_url: `${PDF_BASE_URL}/${e.pdf_key}` }))),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders()
      }
    }
  );
}

// --- Handler for GET /api/events/pdf/:key ---
export async function handleGetEventPdf({ params }, env, ctx) {
  const obj = await env.EVENT_PDFS.get(params.key, { allowScripting: true });
  if (!obj) {
    return new Response('Not found', {
      status: 404,
      headers: corsHeaders()
    });
  }

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata.contentType || 'application/pdf',
      'Content-Disposition': `inline; filename="${params.key}"`,
      'Cache-Control': 'public, max-age=31536000',
      ...corsHeaders()
    }
  });
}

// --- Handler for POST /api/events/create ---
export async function handleCreateEvent(request, env) {
  const cors = handleCORSPreflight(request);
  if (cors) return cors;

  const fd = await request.formData();
  const userId = fd.get('userId');
  if (!userId) {
    return new Response(
      JSON.stringify({
        success: false,
        code: 'AUTH_REQUIRED',
        error: 'Login required to create events.'
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders()
        }
      }
    );
  }
  const file = fd.get('file');

  let pdf_key = null, pdf_hash = null;
  if (file instanceof File) {
    // Your existing logic for file handling and R2 storage
  }

  const insertResult = await env.EVENTS_DB.prepare(
    `INSERT INTO events (user_id, name, date, location, pdf_key, lat, lng, sponsor, contact_email, contact_phone, pdf_hash, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    userId, fd.get('name'), fd.get('date'), fd.get('location'),
    pdf_key, fd.get('lat'), fd.get('lng'), fd.get('sponsor') ?? '',
    fd.get('contactEmail') ?? '', fd.get('contactPhone') ?? '',
    pdf_hash, fd.get('description') ?? ''
  ).run();

  const newEventId = insertResult.meta.last_row_id;

  return new Response(JSON.stringify({ success: true, id: newEventId }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}
