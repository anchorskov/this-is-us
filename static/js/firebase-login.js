/* static/js/firebase-login.js – Firebase v9 + Firebase-UI (UMD) */
console.log("📦 firebase-login.js loaded (v9)");

import {
  getApps,
  initializeApp
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  EmailAuthProvider,
  GoogleAuthProvider,
  PhoneAuthProvider
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

/* ------------------------------------------------------------------ */
/*  Everything lives inside an IIFE so we can `return` early safely   */
/* ------------------------------------------------------------------ */
(function initLoginUI() {
  /* 1️⃣  Ensure a default app exists (user may arrive before firebase-config) */
  if (!getApps().length) {
    const cfgScript = document.getElementById("__fbCfg");
    if (cfgScript) {
      try {
        initializeApp(JSON.parse(cfgScript.textContent));
        console.log("✅ Firebase app initialised manually by login script");
      } catch (err) {
        console.error("❌ Failed to init Firebase app:", err);
        return;                           // abort – no app, no UI
      }
    } else {
      console.warn("⚠️  Firebase config not found – aborting login UI");
      return;                             // abort – no config
    }
  }

  /* 2️⃣  Require the UMD build of Firebase-UI (adds `window.firebaseui`) */
  if (!window.firebaseui) {
    console.error(
      "❌ window.firebaseui missing – " +
      "https://www.gstatic.com/firebasejs/ui/6.0.2/firebase-ui-auth.js " +
      "must load BEFORE this module."
    );
    return;                               // abort – widget can’t run
  }

  /* 3️⃣  Create (or reuse) the Auth-UI instance */
  const auth = getAuth();
  const ui =
    window.firebaseui.auth.AuthUI.getInstance() ||
    new window.firebaseui.auth.AuthUI(auth);

  /*  Expose so /login/ template can call `window.firebaseUI.ui.start()`  */
  window.firebaseUI = { ui };

  /* 4️⃣  Launch the widget only when container is present & user is signed-out */
  document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("firebaseui-auth-container");
    if (!container) return;

    /* Don’t start twice */
    if (container.dataset.uiReady) return;
    container.dataset.uiReady = "true";

    const uiConfig = {
      signInFlow   : "popup",
      signInOptions: [
        { provider: EmailAuthProvider.PROVIDER_ID, requireDisplayName: true },
        GoogleAuthProvider.PROVIDER_ID,
        PhoneAuthProvider.PROVIDER_ID
      ],
      tosUrl          : "/manifesto/",
      privacyPolicyUrl: "/about/"
    };

    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("🔐 Already signed in – hiding login UI");
        container.style.display = "none";
      } else {
        console.log("🚀 Launching Firebase-UI widget");
        ui.start("#firebaseui-auth-container", uiConfig);
      }
    });
  });
})();   // <-- IIFE ends here
