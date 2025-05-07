// static/js/firebase-auth.js

console.log("🔥 Auth script has been loaded and is running.");

// Ensure Firebase is ready
if (typeof firebase === "undefined" || typeof firebaseui === "undefined") {
  console.error("❌ Firebase or FirebaseUI not loaded.");
} else {
  const ui = new firebaseui.auth.AuthUI(firebase.auth());

  const uiConfig = {
    signInOptions: [
      {
        provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
        requireDisplayName: true,
      },
      firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    ],
    signInFlow: "popup",
    tosUrl: "/manifesto/",
    privacyPolicyUrl: "/about/",
    callbacks: {
      signInSuccessWithAuthResult: function (authResult, redirectUrl) {
        if (authResult.user && authResult.user.emailVerified) {
          const redirect = new URLSearchParams(window.location.search).get("redirect") || "/";
          window.location.href = redirect;
        } else {
          alert("Please verify your email before continuing.");
          firebase.auth().signOut();
        }
        return false; // Prevent default redirect
      },
    },
  };

  function initAuthUI() {
    const container = document.getElementById("firebaseui-auth-container");
    if (container) {
      ui.start(container, uiConfig);
    }
  }

  function setupLogoutButton() {
    const logoutBtn = document.getElementById("logout-btn");
    if (!logoutBtn) return;

    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        logoutBtn.style.display = "inline-block";
        logoutBtn.onclick = () => {
          firebase.auth().signOut()
            .then(() => {
              alert("Logged out.");
              window.location.reload();
            })
            .catch(err => console.error("Logout error:", err));
        };
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("firebaseui-auth-container")) {
      initAuthUI();
    }
    setupLogoutButton();
  });
}
