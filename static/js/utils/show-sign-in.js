/* ----------------------------------------------------------------
    File: /static/js/utils/show-sign-in.js
    Description: Re-usable helper that injects a “please sign in”
                 overlay for protected content.
   ----------------------------------------------------------------- */

export function showSignInGate(opts = {}) {
  const {
    container = document.body,
    message   = "Sign in to view this content",
    buttonTxt = "Sign in / Sign up"
  } = opts;

  // Clear the container (e.g., remove "Loading..." message)
  container.innerHTML = '';

  // Create the overlay elements
  const gate = document.createElement("section");
  gate.className = "flex flex-col items-center justify-center gap-6 py-20 text-center";
  gate.innerHTML = /* html */`
    <p class="text-xl text-gray-700">${message}</p>
    <button id="signInBtn"
            class="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
      ${buttonTxt}
    </button>`;
  
  // Append the new content
  container.appendChild(gate);

  // Wire up the button to your existing FirebaseUI popup logic
  // Note: This relies on `window.startFirebaseUiAuth` being available globally.
  const signInBtn = gate.querySelector("#signInBtn");
  signInBtn?.addEventListener("click", () => {
    if (window.startFirebaseUiAuth) {
      window.startFirebaseUiAuth();
    } else {
      console.warn("FirebaseUI auth helper not found. Redirecting to login page.");
      window.location.href = '/login/'; // Fallback
    }
  });
}
