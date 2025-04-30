document.addEventListener("DOMContentLoaded", () => {
  const authContainer = document.getElementById("auth-container");
  const formContainer = document.getElementById("form-container");
  const loginLink = document.getElementById("login-link");

  // When link clicked, render FirebaseUI
  loginLink.addEventListener("click", e => {
    e.preventDefault();
    ui.start("#auth-container", uiConfig);
  });

  // Monitor auth state
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      authContainer.style.display = "none";
      formContainer.style.display = "block";
    } else {
      authContainer.style.display = "block";
      formContainer.style.display = "none";
    }
  });
});
