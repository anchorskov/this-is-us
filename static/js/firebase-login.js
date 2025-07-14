/* static/js/firebase-login.js – Firebase v9 + Firebase-UI (UMD) */
console.log("📦 firebase-login.js loaded (v9)");

import {
  getApps,
  initializeApp
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  getRedirectResult,
  EmailAuthProvider,
  GoogleAuthProvider,
  PhoneAuthProvider
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

/* ------------------------------------------------------------------ */
/*  Everything lives inside an IIFE so we can `return` early safely   */
/* ------------------------------------------------------------------ */
(function initLoginUI() {
  // 1️⃣ Ensure a Firebase app is initialized
  if (!getApps().length) {
    const cfgScript = document.getElementById("__fbCfg");
    if (cfgScript) {
      try {
        initializeApp(JSON.parse(cfgScript.textContent));
        console.log("✅ Firebase app initialised manually by login script");
      } catch (err) {
        console.error("❌ Failed to init Firebase app:", err);
        return;
      }
    } else {
      console.warn("⚠️ Firebase config not found – aborting login UI");
      return;
    }
  }

  // 2️⃣ Confirm FirebaseUI UMD script is loaded
  if (!window.firebaseui) {
    console.error("❌ window.firebaseui missing – ensure FirebaseUI UMD script is loaded BEFORE this module.");
    return;
  }

  // 3️⃣ Create or reuse FirebaseUI instance
  const auth = getAuth();
  const ui =
    window.firebaseui.auth.AuthUI.getInstance() ||
    new window.firebaseui.auth.AuthUI(auth);

  window.firebaseUI = { ui }; // Expose for debug/testing

  // 4️⃣ Launch widget when DOM is ready
  document.addEventListener("DOMContentLoaded", async () => {
    const container = document.getElementById("firebaseui-auth-container");
    if (!container || container.dataset.uiReady === "true") return;

    container.dataset.uiReady = "true";

    const uiConfig = {
      signInFlow: "popup",
      signInOptions: [
        { provider: EmailAuthProvider.PROVIDER_ID, requireDisplayName: true },
        GoogleAuthProvider.PROVIDER_ID,
        PhoneAuthProvider.PROVIDER_ID
      ],
      tosUrl: "/manifesto/",
      privacyPolicyUrl: "/about/"
    };

    // Extract ?redirect=/account/ (or fallback)
    const params = new URLSearchParams(window.location.search);
    const stored = sessionStorage.getItem("redirectAfterLogin");
    const redirect = params.get("redirect") || stored || document.referrer || "/";

    // 5️⃣ If we came back from a redirect, act on it
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        console.log("✅ Redirect login success:", result.user.email);
        container.style.display = "none";
        console.log("➡️ Redirecting to:", redirect);
        window.location.href = redirect;
        sessionStorage.removeItem("redirectAfterLogin");
        return;
      }
    } catch (err) {
      console.warn("⚠️ Redirect result error:", err);
    }

    // 6️⃣ Check if already signed in and redirect
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("🔐 Already signed in – hiding login UI");
        container.style.display = "none";
        console.log("➡️ Redirecting to:", redirect);
        window.location.href = redirect;
      } else {
        console.log("🚀 Launching Firebase-UI widget");
        ui.start("#firebaseui-auth-container", uiConfig);
      }
    });
  });
})();
