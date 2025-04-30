// static/js/firebase-auth.js
console.log("🔥 Auth script has been loaded and is running.");

(function(){
  function initAuthUI() {
    const authContainer = document.getElementById("auth-container");
    const formContainer = document.getElementById("form-container");
    const loginLink     = document.getElementById("login-link");

    // Basic prerequisites
    if (!loginLink) {
      console.warn("⚠️ initAuthUI: #login-link not found");
      return;
    }
    if (typeof firebase === 'undefined') {
      console.error("❌ initAuthUI: firebase is undefined");
      return;
    }
    if (typeof firebaseui === 'undefined') {
      console.error("❌ initAuthUI: firebaseui is undefined");
      return;
    }
    if (typeof ui === 'undefined' || typeof uiConfig === 'undefined') {
      console.error("❌ initAuthUI: ui or uiConfig is undefined");
      return;
    }

    // Wire up the “log in” button click
    loginLink.addEventListener("click", e => {
      e.preventDefault();
      const uiContainer = document.getElementById("firebaseui-auth-container");
      if (!uiContainer) {
        console.error("❌ initAuthUI: #firebaseui-auth-container not found");
        return;
      }
      ui.start("#firebaseui-auth-container", uiConfig);
    });

    // React to auth changes
    firebase.auth().onAuthStateChanged(user => {
      // Ensure we have the containers
      if (!authContainer) {
        console.warn("⚠️ onAuthStateChanged: #auth-container missing");
      }
      if (!formContainer) {
        console.warn("⚠️ onAuthStateChanged: #form-container missing");
      }

      if (user) {
        // Logged in → show form, prepend logout
        if (authContainer) authContainer.style.display = "none";
        if (formContainer) {
          formContainer.style.display = "block";
          // Clean up any old logout buttons
          const old = formContainer.querySelector("button.auth-logout");
          if (old) old.remove();
          const logoutBtn = document.createElement("button");
          logoutBtn.textContent = "Logout";
          logoutBtn.className = "auth-logout";
          logoutBtn.onclick = () =>
            firebase.auth().signOut().then(() => location.reload());
          formContainer.prepend(logoutBtn);
        }
      } else {
        // Logged out → show login prompt, hide form
        if (authContainer) authContainer.style.display = "flex";
        if (formContainer) formContainer.style.display = "none";
      }
    });
  }

  // Kick it off when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuthUI);
  } else {
    initAuthUI();
  }
})();
