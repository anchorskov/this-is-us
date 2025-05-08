// login-modal.js (cleaned and Firebase v8 compatible)

// Assumes firebase and firebase.auth() are already available via firebase-init.html

document.addEventListener("DOMContentLoaded", () => {
  const auth = firebase.auth();

  const modal = document.getElementById("loginModal");
  const loginBtn = document.getElementById("menu-login");
  const closeBtn = document.getElementById("closeLoginModal");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");

  if (!auth || !modal) {
    console.warn("⚠️ Firebase or modal DOM not ready");
    return;
  }

  // Open login modal
  loginBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    modal.classList.add("show");
    loginError?.classList.add("hidden");
  });

  // Close login modal
  closeBtn?.addEventListener("click", () => {
    modal.classList.remove("show");
  });

  // Handle login form submission
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value;

    if (!email || !password) return;

    try {
      await auth.signInWithEmailAndPassword(email, password);
      modal.classList.remove("show");
      window.location.reload();
    } catch (err) {
      console.error("❌ Login error:", err);
      if (loginError) {
        loginError.textContent = err.message;
        loginError.classList.remove("hidden");
      }
    }
  });

  // Optional: Close modal on outside click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("show");
    }
  });
});
