/* firebase-ui-config.js – Firebase v9 */
console.log("🔥 Firebase UI config loaded (v9)");

import {
  getAuth,
  EmailAuthProvider,
  GoogleAuthProvider,
  PhoneAuthProvider
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

/* ------------------------------------------------------------------ */
/* Wait until the UMD build is present. If it's missing, just warn.   */
/* ------------------------------------------------------------------ */
let ui = null;
let uiConfig = null;

if (!window.firebaseui) {
  console.error(
    "❌ firebaseui global missing – ensure " +
      "https://www.gstatic.com/firebasejs/ui/6.0.2/firebase-ui-auth.js " +
      "is loaded before this module."
  );
} else {
  const auth = getAuth();

  ui =
    window.firebaseui.auth.AuthUI.getInstance() ||
    new window.firebaseui.auth.AuthUI(auth);

  uiConfig = {
    signInFlow: "popup",
    signInOptions: [
      { provider: EmailAuthProvider.PROVIDER_ID, requireDisplayName: true },
      GoogleAuthProvider.PROVIDER_ID,
      PhoneAuthProvider.PROVIDER_ID
    ],
    tosUrl: "/manifesto/",
    privacyPolicyUrl: "/about/",
    callbacks: {
      signInSuccessWithAuthResult({ user }) {
        console.log("✅ FirebaseUI login complete:", {
          uid: user?.uid,
          email: user?.email,
          phone: user?.phoneNumber,
          verified: user?.emailVerified
        });
        const target =
          new URLSearchParams(location.search).get("redirect") || "/account/";
        setTimeout(() => (location.href = target), 300);
        return false; // prevent auto-redirect
      },
      uiShown() {
        console.log("🧩 FirebaseUI shown");
      }
    }
  };

  /* Expose globally so /login/ page can call ui.start() */
  window.firebaseUI = { ui, uiConfig };
}

/* Top-level export (ES-module compliant) */
export { uiConfig };
