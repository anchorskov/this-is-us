document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("floating-auth");
    if (!container || typeof firebase === "undefined") return;
  
    firebase.auth().onAuthStateChanged(user => {
      if (!user) {
        container.innerHTML = `
          <button class="auth-btn" onclick="window.location.href='/login'">Login</button>
        `;
      } else {
        container.innerHTML = `
          <span class="mr2">👋 ${user.displayName || user.email}</span>
          <button class="auth-btn logout" onclick="firebase.auth().signOut().then(() => location.reload())">
            Logout
          </button>
        `;
      }
    });
  });
  