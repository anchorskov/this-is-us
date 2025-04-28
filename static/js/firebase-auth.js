document.addEventListener("DOMContentLoaded", () => {
  const authContainer = document.getElementById("auth-container");
  const formContainer = document.getElementById("form-container");
  const loginLink     = document.getElementById("login-link");

  loginLink.addEventListener("click", e => {
    e.preventDefault();
    ui.start("#auth-container", uiConfig);
  });

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      authContainer.style.display = "none";
      formContainer.style.display = "block";
      const logoutBtn = document.createElement("button");
      logoutBtn.textContent = "Logout";
      logoutBtn.onclick = () => firebase.auth().signOut().then(() => location.reload());
      formContainer.prepend(logoutBtn);
    } else {
      authContainer.style.display = "block";
      formContainer.style.display = "none";
    }
  });
});
