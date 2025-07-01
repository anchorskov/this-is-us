/* static/js/events/submit-event.js
   — POST the event to the Cloud-Worker — */

import { safeFetch } from '../utils/safe-fetch.js';
import { getUserFriendlyError } from './error-manager.js';

const API_ROOT   = (window.EVENTS_API_URL || '/api').replace(/\/$/, '');
const CREATE_URL = `${API_ROOT}/events/create`;

/**
 * @param {Object} payload – key/value pairs from the form (+ lat/lng, + optional File)
 * @returns {Promise<{ok:boolean,id?:string,message?:string}>}
 */
export async function submitEvent (payload) {
  /* Build FormData — PDF is optional */
  const fd = new FormData();

  for (const [k, v] of Object.entries(payload)) {
    if (k === 'file') continue;               // handle below
    fd.append(k, v ?? '');                    // never send literal “undefined”
  }

  if (payload.file instanceof File) {
    fd.append('file', payload.file, payload.file.name);
  }

  try {
    const body = await safeFetch(CREATE_URL, { method: 'POST', body: fd });

    /* ✅ success path */
    if (body?.success === true) {
      console.log('✅ API success →', body);
      return { ok: true, id: body.id };
    }

    /* ❌ server sent JSON with error */
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
