// static/js/events/submit-event.js

// ——————————————————————————————————————————
// Configuration
// ——————————————————————————————————————————
const API_URL = window.EVENTS_API_URL || "/api/events/create";

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
    const res = await fetch(API_URL, {
      method: "POST",
      body: formData,
    });
    const body = await res.json();

    return {
      ok: res.ok && body.success === true,
      message: body.error || (res.ok ? "Event submitted." : "Submission failed."),
    };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}
