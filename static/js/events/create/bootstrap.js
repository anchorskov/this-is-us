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

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

/* Run **only after** the DOM is fully parsed so #map exists  */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🧱 create-event bootstrap ready');
  const auth = getAuth();
  const gate   = document.getElementById('create-auth-gate');
  const wizard = document.getElementById('create-event-wizard');
  const loginBox = document.getElementById('firebaseui-auth-container');

  const showGate = () => {
    console.log('🚧 create-event: showing auth gate');
    gate?.classList.remove('hidden');
    wizard?.classList.add('hidden');
    loginBox?.classList.remove('hidden');
  };

  const hideGate = () => {
    console.log('✅ create-event: hiding auth gate, showing wizard');
    gate?.classList.add('hidden');
    wizard?.classList.remove('hidden');
    loginBox?.classList.add('hidden');
    document.dispatchEvent(new Event('wizardShown'));
  };

  let wizardInitialised = false;

  const initWizard = async (user) => {
    if (wizardInitialised) return;
    wizardInitialised = true;

    hideGate();

    const db = getFirestore();

    /* 1️⃣  If the user has a saved ZIP → centre the map there */
    const savedZip = await getUserZip(db, user.uid);
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

    /* 2️⃣  ZIP → city/state auto-fill */
    initAddressFields();

    /* 3️⃣  Build the map & locator UI */
    setupMapLocator({
      mapId   : 'map',
      formId  : 'addressForm',
      errorId : 'errorMsg',
      resultId: 'latlonDisplay',
    });
    document.dispatchEvent(new Event('wizardShown'));

    /* 4️⃣  The event-details form is now managed by form-flow.js based on user interaction. */
  };

  // Default to gate while auth state is resolving
  showGate();

  const attemptImmediateBootstrap = () => {
    const user = auth.currentUser || window.currentUser || null;
    if (user) {
      console.log('🟢 create-event: bootstrap via currentUser/window.currentUser');
      initWizard(user);
      return true;
    }
    return false;
  };

  if (!attemptImmediateBootstrap()) {
    const poll = setInterval(() => {
      if (attemptImmediateBootstrap()) clearInterval(poll);
    }, 300);
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      console.log('🔒 create-event: no user – showing login gate');
      showGate();
      if (wizardInitialised) {
        window.location.reload();
      }
      return;
    }

    console.log('🔓 create-event: user detected – bootstrapping wizard');
    initWizard(user);
  });
});
