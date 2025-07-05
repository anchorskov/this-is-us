// ────────────────────────────────────────────────────────────────
// static/js/events/create/bootstrap.js
// 🧭  Bootstrap “Create Event” page
//    – waits for Firebase auth
//    – zooms to saved ZIP (if any)
//    – wires ZIP→city/state auto-fill
//    – mounts Leaflet map / locator UI
// ────────────────────────────────────────────────────────────────

import { setupMapLocator   } from './map-locator.js';
import { initAddressFields } from './address-fields.js';
import { getUserZip        } from '../../lib/firestore-profile.js';
import   geocode             from '../../lib/geocode.js';
// The renderForm function is no longer called from this file.

/* Run **only after** the DOM is fully parsed so #map exists  */
document.addEventListener('DOMContentLoaded', async () => {
  /* 1️⃣  Wait for Firebase Auth to settle */
  await firebase.auth().authStateReady;
  const user = firebase.auth().currentUser;
  const uid  = user?.uid ?? null;
  const db   = firebase.firestore();

  /* 2️⃣  If the user has a saved ZIP → centre the map there   */
  const savedZip = await getUserZip(db, uid);
  if (savedZip) {
    try {
      const { lat, lon } = await geocode(savedZip);
      document.dispatchEvent(new CustomEvent('zoomToZip', {
        detail: { lat, lon, zoom: 10 }
      }));
      console.log('📦 Zoomed to saved ZIP:', savedZip);
    } catch (err) {
      console.warn('❗ Failed to geocode saved ZIP:', err.message);
    }
  }

  /* 3️⃣  ZIP → city/state auto-fill                          */
  initAddressFields();

  /* 4️⃣  Build the map & locator UI                            */
  setupMapLocator({
    mapId   : 'map',
    formId  : 'addressForm',
    errorId : 'errorMsg',
    resultId: 'latlonDisplay',
  });

  /* 5️⃣  The event-details form is now managed by form-flow.js based on user interaction. */
  // renderForm(user); // This line was removed to prevent re-initializing the map.
});