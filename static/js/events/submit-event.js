// static/js/events/submit-event.js

// ——————————————————————————————————————————
// Configuration
// ——————————————————————————————————————————
// Base API root (set by site-scripts.html):
const API_ROOT = (window.EVENTS_API_URL || "/api").replace(/\/$/, '');
// Endpoint for creating events:
const CREATE_URL = `${API_ROOT}/events/create`;

/**
 * Submit event data (including the PDF file) to our Worker.
 * @param {Object} payload  Plain JS object with keys matching D1 columns,
 *                          and including a `file: File` property.
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export async function submitEvent(payload) {
  // Build FormData for streaming upload
  const formData = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    formData.append(key, value);
  }

  try {
    const res = await fetch(CREATE_URL, {
      method: "POST",
      body: formData,
    });

    // Attempt to parse JSON, fall back to text
    let body;
    try {
      body = await res.json();
    } catch {
      const text = await res.text();
      body = { success: res.ok, error: text };
    }

    return {
      ok: res.ok && body.success === true,
      message: body.error || (res.ok ? "Event submitted." : "Submission failed."),
    };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}
