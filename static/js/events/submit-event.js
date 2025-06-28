/* static/js/events/submit-event.js
   — POST the event to the Cloud-Worker —                              */

import { safeFetch }            from '../utils/safe-fetch.js';
import { getUserFriendlyError } from './error-manager.js';

const API_ROOT   = (window.EVENTS_API_URL || '/api').replace(/\/$/, '');
const CREATE_URL = `${API_ROOT}/events/create`;

/**
 * @param {Object} payload – key/value pairs from the form + lat/lng
 * @returns {Promise<{ok:boolean,id?:string,message?:string}>}
 */
export async function submitEvent(payload) {

  /* build FormData so <input type="file"> could be handled later */
  const fd = new FormData();
  for (const [k, v] of Object.entries(payload)) fd.append(k, v);

  try {
    const body = await safeFetch(CREATE_URL, { method: 'POST', body: fd });

    /* ✅ success path */
    if (body?.success === true) {
      console.log('✅ API success →', body);
      return { ok: true, id: body.id };
    }

    /* ❌ server returned an error object */
    console.warn('⚠️ API rejected →', body);
    return {
      ok: false,
      message: getUserFriendlyError(body?.code, body?.error)
    };

  } catch (err) {
    /* 🛑 network / CORS / timeout failure */
    console.error('❌ fetch failed →', err);
    return {
      ok: false,
      message: getUserFriendlyError(undefined, err.message)
    };
  }
}
