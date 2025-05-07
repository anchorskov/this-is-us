document.addEventListener("DOMContentLoaded", () => {
  const authContainer = document.getElementById("auth-container");
  const formContainer = document.getElementById("form-container");
  const loginLink     = document.getElementById("login-link");

  // Safely get or create FirebaseUI instance
  const ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(firebase.auth());

  // Handle login link (if present)
  if (loginLink) {
    loginLink.addEventListener("click", e => {
      e.preventDefault();
      if (authContainer && typeof window.uiConfig !== "undefined") {
        ui.start("#auth-container", window.uiConfig);
      } else {
        console.warn("❌ auth-container or uiConfig missing");
      }
    });
  }

  // Monitor login state
  if (authContainer && formContainer) {
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        authContainer.style.display = "none";
        formContainer.style.display = "block";
      } else {
        authContainer.style.display = "block";
        formContainer.style.display = "none";
      }
    });
  }
});
