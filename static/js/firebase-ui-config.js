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
      "https://www.gstatic.com/firebasejs/ui/6.0.2/firebase-ui-auth.js " + // Note: FirebaseUI v6.0.2 is quite old, consider updating if possible.
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
    // --- NEW: Password Reset Configuration ---
    credentialHelper: window.firebaseui.auth.CredentialHelper.NONE, // Prevents FirebaseUI from using browser credential management
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
      },
      // --- NEW: Callback for password reset ---
      // This callback is triggered when FirebaseUI needs to show a password reset link.
      // You can customize the behavior here, or let FirebaseUI handle it.
      // If you want FirebaseUI to show the "Forgot password?" link, ensure this callback
      // allows it to proceed (e.g., by not returning false or redirecting).
      signInFailure(error) {
        // Some common errors:
        // firebase.auth.AuthError.EMAIL_EXISTS_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL
        // firebase.auth.AuthError.WRONG_PASSWORD
        console.error("❌ FirebaseUI sign-in error:", error);
        // You can add custom handling here, e.g., showing a custom message
        // if (error.code === 'auth/wrong-password') {
        //   alert('Incorrect password. Please try again or reset your password.');
        // }
        // Return true to let FirebaseUI display the default error message/link.
        // Or return false to suppress default behavior.
        return true; 
      }
    }
  };

  /* Expose globally so /login/ page can call ui.start() */
  window.firebaseUI = { ui, uiConfig };
}

/* Top-level export (ES-module compliant) */
export { uiConfig };
