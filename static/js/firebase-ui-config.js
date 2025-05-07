// static/js/firebase-ui-config.js

console.log("🔥 Firebase UI config loaded");

// Only run if Firebase is loaded
if (typeof firebase !== "undefined" && firebase.auth) {
  window.uiConfig = {
    signInSuccessUrl: "/events/create/",

    signInOptions: [
      firebase.auth.EmailAuthProvider.PROVIDER_ID,
      firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      firebase.auth.PhoneAuthProvider.PROVIDER_ID
    ],

    tosUrl: "/manifesto/",
    privacyPolicyUrl: "/about/",

    callbacks: {
      signInSuccessWithAuthResult: function (authResult, redirectUrl) {
        console.log("✅ User signed in:", authResult.user);
        return true; // Redirect to signInSuccessUrl
      },
      uiShown: function () {
        console.log("🧩 FirebaseUI shown");
      }
    }
  };
} else {
  console.warn("⚠️ Firebase not loaded — skipping UI config.");
}
