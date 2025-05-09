import { renderForm } from './event-form.js';

console.log("⚙️ Initializing Event Creation Flow");

document.addEventListener("DOMContentLoaded", () => {
  const waitForAuth = setInterval(() => {
    if (typeof firebase !== "undefined" && firebase.auth && typeof window.currentUser !== "undefined") {
      clearInterval(waitForAuth);

      const user = window.currentUser;
      if (user && (user.emailVerified || user.phoneNumber)) {
        // ✅ Hide login prompt
        const authContainer = document.getElementById("auth-container");
        if (authContainer) authContainer.style.display = "none";

        renderForm(user);
      } else {
        console.warn("⚠️ User not verified or not logged in");
      }
    }
  }, 200);
});
