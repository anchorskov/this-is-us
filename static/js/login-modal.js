// login-modal.js

// Import Firebase auth (assume firebase-config.js is already loaded)
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth-compat.js";

const auth = firebase.auth();

// DOM Elements
const modal = document.getElementById("loginModal");
const loginBtn = document.getElementById("menu-login");
const closeBtn = document.getElementById("closeLoginModal");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

// Open login modal
loginBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  modal.classList.add("show");
});

// Close login modal
closeBtn?.addEventListener("click", () => {
  modal.classList.remove("show");
});

// Form submission handling
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await auth.signInWithEmailAndPassword(email, password);
    modal.classList.remove("show");
    window.location.reload();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.classList.remove("hidden");
  }
});

// Optional: Close modal if user clicks outside the login form
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.remove("show");
  }
});
