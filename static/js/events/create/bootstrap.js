// static/js/events/create/bootstrap.js
// 🧭 Bootstrap Create Event Page: Auth, Map, Profile ZIP, Form

import { setupMapLocator } from './map-locator.js';
import { initAddressFields } from './address-fields.js';
import { getUserZip } from '../../lib/firestore-profile.js';
import geocode from '../../lib/geocode.js';
import { renderForm } from '../event-form.js';

(async function () {
  // 1️⃣ Wait for Firebase auth to initialize
  await firebase.auth().authStateReady;
  const user = firebase.auth().currentUser;
  const uid = user?.uid || null;
  const db = firebase.firestore();

  // 2️⃣ If user has saved ZIP, zoom map to it
  const savedZip = await getUserZip(db, uid);
  if (savedZip) {
    try {
      const { lat, lon } = await geocode(savedZip);
      // Dispatch custom event to center map
      document.dispatchEvent(new CustomEvent("zoomToZip", {
        detail: { lat, lon, zoom: 10 }
      }));
      console.log("📦 Zoomed to saved ZIP:", savedZip);
    } catch (err) {
      console.warn("❗ Failed to geocode saved ZIP:", err.message);
    }
  }

  // 3️⃣ Setup ZIP-based city/state auto-fill
  initAddressFields();

  // 4️⃣ Setup Map + Locator UI
  setupMapLocator({
    mapId: "map",
    formId: "addressForm",
    errorId: "errorMsg",
    resultId: "latlonDisplay"
  });

  // 5️⃣ Render Form (hidden by default until locationSet)
  renderForm(user);
})();
