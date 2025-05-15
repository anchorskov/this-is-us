// static/js/events/submit-event.js

import { safeFetch } from '../utils/safe-fetch.js';

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
 *                          including a `file: File` property.
 * @returns {Promise<{ok: boolean, id?: string, message?: string}>}
 */
export async function submitEvent(payload) {
  // Log outgoing payload for debugging
  console.log("📡 Submitting event payload:", payload);

  // Verify lat/lng presence
  if (!payload.lat || !payload.lng) {
    console.warn("⚠️ Missing lat/lng — map button may not render.");
  }

  // Build FormData for streaming upload
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, value);
  });

  try {
    // Use safeFetch for uniform HTTP/status parsing and JSON handling
    const body = await safeFetch(CREATE_URL, {
      method: 'POST',
      body: formData,
    });

    // Worker returns { success: true, id: "<newId>" }
    if (body.success === true) {
      console.log("✅ Submission succeeded:", body);
      return { ok: true, id: body.id };
    } else {
      // Our Worker signaled a problem
      console.error("❌ Worker error:", body.error);
      return {
        ok: false,
        message: body.error || 'Submission failed.',
      };
    }
  } catch (err) {
    // Network failure or non-2xx status routed here
    console.error("❌ Submission failed:", err.message);
    return { ok: false, message: err.message };
  }
}
