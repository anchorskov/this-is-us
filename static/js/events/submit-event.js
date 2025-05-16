// 📦 static/js/events/submit-event.js

import { safeFetch } from '../utils/safe-fetch.js';
import { getUserFriendlyError } from './error-manager.js';
import { showSuccess, showError, toggleLoading } from './ui-feedback.js';

// ——————————————————————————————————————————
// Configuration
// ——————————————————————————————————————————
const API_ROOT = (window.EVENTS_API_URL || "/api").replace(/\/$/, '');
const CREATE_URL = `${API_ROOT}/events/create`;

/**
 * Submits an event to the backend.
 * @param {Object} payload - Object with event fields and file.
 * @returns {Promise<{ok: boolean, id?: string, message?: string}>}
 */
export async function submitEvent(payload) {
  console.log("📡 Submitting event payload:", payload);

  if (!payload.lat || !payload.lng) {
    console.warn("⚠️ Missing lat/lng — map button may not render.");
  }

  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(key, value);
  });

  toggleLoading(true, "#confirmSubmit");

  try {
    const body = await safeFetch(CREATE_URL, {
      method: 'POST',
      body: formData,
    });

    if (body.success === true) {
      console.log("✅ Submission succeeded:", body);
      showSuccess("✅ Event submitted successfully!");
      return { ok: true, id: body.id };
    } else {
      const message = getUserFriendlyError(body.code, body.error);
      console.error("❌ Worker error:", message);
      showError(`❌ ${message}`);
      return { ok: false, message };
    }

  } catch (err) {
    const fallback = getUserFriendlyError(undefined, err.message);
    console.error("❌ Submission failed:", fallback);
    showError(`❌ ${fallback}`);
    return { ok: false, message: fallback };
  } finally {
    toggleLoading(false, "#confirmSubmit");
  }
}
