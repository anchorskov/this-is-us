// static/js/firebase-login.js
console.log("📦 firebase-login.js loaded");

if (typeof firebase === "undefined" || typeof firebaseui === "undefined") {
  console.error("❌ Firebase or FirebaseUI not loaded.");
} else {
  const auth = firebase.auth();
  window.ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(auth);

  window.uiConfig = {
    signInOptions: [
      {
        provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
        requireDisplayName: true,
      },
      firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      firebase.auth.PhoneAuthProvider.PROVIDER_ID,
    ],
    signInFlow: "popup",
    tosUrl: "/manifesto/",
    privacyPolicyUrl: "/about/",
    callbacks: {
      async signInSuccessWithAuthResult(authResult) {
        const user = authResult.user;

        console.log("✅ Login success:", {
          uid: user?.uid,
          email: user?.email,
          phone: user?.phoneNumber,
          verified: user?.emailVerified,
        });

        if (user && (user.emailVerified || user.phoneNumber)) {
          const redirect =
            new URLSearchParams(window.location.search).get("redirect") ||
            "/account/";
          console.log("🔁 Redirecting to:", redirect);
          window.location.href = redirect;
        } else {
          alert("Please verify your email before continuing.");
          await firebase.auth().signOut(); // Use full path if `auth` is not in scope
        }

        return false; // Prevent default FirebaseUI redirect
      },
      uiShown() {
        console.log("🧠 FirebaseUI rendered.");
      },
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("firebaseui-auth-container");

    if (container && !window.__handledLoginUI) {
      firebase.auth().onAuthStateChanged((user) => {
        if (!user || !(user.emailVerified || user.phoneNumber)) {
          console.log("🚀 Launching FirebaseUI");
          window.__handledLoginUI = true;
          window.ui.start("#firebaseui-auth-container", window.uiConfig);
        } else {
          console.log("🔐 User already logged in — hiding login UI");
          container.style.display = "none";
        }
      });
    }
  });
}
