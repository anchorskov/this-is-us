// static/js/firebase-idle-logout.js  – v9 module
console.log("🕒 firebase-idle-logout.js loaded (v9)");

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

const auth = getAuth();
const TIMEOUT = 30 * 60 * 1000; // 30 min
let idleTimer;

const resetTimer = () => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    await signOut(auth);
    alert("You’ve been logged out due to inactivity.");
    location.reload();
  }, TIMEOUT);
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("🛡️ Idle logout monitoring active for", user.email || user.uid);
    ["click", "mousemove", "keydown", "scroll", "touchstart"].forEach((evt) =>
      window.addEventListener(evt, resetTimer, true)
    );
    resetTimer();
  } else {
    console.log("⏸️ No active user session — idle logout not enabled.");
  }
});
