// static/js/firebase-idle-logout.js
console.log("🕒 firebase-idle-logout.js loaded");

if (typeof firebase === "undefined") {
  console.error("❌ Firebase not available.");
} else {
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      console.log("🛡️ Idle logout monitoring active for", user.email || user.uid);

      const TIMEOUT = 30 * 60 * 1000; // 30 minutes in ms
      let idleTimer;

      const resetTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          firebase.auth().signOut().then(() => {
            alert("You’ve been logged out due to inactivity.");
            location.reload();
          });
        }, TIMEOUT);
      };

      // User activity events to reset timer
      ["click", "mousemove", "keydown", "scroll", "touchstart"].forEach(event =>
        window.addEventListener(event, resetTimer, true)
      );

      resetTimer();
    } else {
      console.log("⏸️ No active user session — idle logout not enabled.");
    }
  });
}
