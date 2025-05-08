// ✅ Cleaned and Improved firebase-auth.js
console.log("🔥 Auth script has been loaded and is running.");

if (typeof firebase === "undefined" || typeof firebaseui === "undefined") {
  console.error("❌ Firebase or FirebaseUI not loaded.");
} else {
  const auth = firebase.auth();
  window.ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(auth);

  const persistence = location.hostname === "localhost"
    ? firebase.auth.Auth.Persistence.SESSION
    : firebase.auth.Auth.Persistence.LOCAL;

  auth.setPersistence(persistence)
    .then(() => console.log("🔐 Persistence set:", persistence))
    .catch(err => console.error("❌ Failed to set persistence:", err));

  // Set global user context on page load
  auth.onAuthStateChanged(user => {
    window.currentUser = user || null;
    console.log("🔄 Auth state changed:", user?.email || "Not signed in");
  });

  window.uiConfig = {
    signInOptions: [
      { provider: firebase.auth.EmailAuthProvider.PROVIDER_ID, requireDisplayName: true },
      firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      firebase.auth.PhoneAuthProvider.PROVIDER_ID
    ],
    signInFlow: "popup",
    tosUrl: "/manifesto/",
    privacyPolicyUrl: "/about/",
    callbacks: {
      signInSuccessWithAuthResult(authResult) {
        const user = authResult.user;
        console.log("✅ Login success:", {
          uid: user?.uid,
          email: user?.email,
          phone: user?.phoneNumber,
          verified: user?.emailVerified,
        });
        if (user && (user.emailVerified || user.phoneNumber)) {
          const redirect = new URLSearchParams(window.location.search).get("redirect") || "/events/create/";
          window.location.href = redirect;
        } else {
          alert("Please verify your email before continuing.");
          auth.signOut();
        }
        return false;
      },
      uiShown() {
        console.log("🧠 FirebaseUI rendered.");
      }
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("firebaseui-auth-container");
    if (container && !window.__handledLoginUI) {
      console.log("📦 Launching FirebaseUI login");
      window.__handledLoginUI = true;
      window.ui.start("#firebaseui-auth-container", window.uiConfig);
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      auth.onAuthStateChanged(user => {
        logoutBtn.style.display = user ? "inline-block" : "none";
        logoutBtn.onclick = () => {
          auth.signOut().then(() => location.reload());
        };
      });
    }
  });
}
