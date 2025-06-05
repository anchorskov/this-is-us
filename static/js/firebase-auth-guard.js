// /static/js/firebase-auth-guard.js

console.log("🛡️ firebase-auth-guard.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  // Paths that require a logged-in user
  const protectedPaths = [
    "/townhall",
    "/townhall/interactive",
    "/events/create",
    "/account",
    "/admin",
    "/sandbox"
  ];

  const normalizePath = path => path.replace(/\/+$/, "");

  // Wait until Firebase is ready
  const waitForFirebase = () => {
    if (typeof firebase === "undefined" || !firebase.auth) {
      console.warn("⚠️ Firebase not ready, retrying...");
      return setTimeout(waitForFirebase, 100);
    }

    firebase.auth().onAuthStateChanged(user => {
      const currentPath = normalizePath(window.location.pathname);

      const isProtected = protectedPaths.some(protected =>
        currentPath === normalizePath(protected) ||
        currentPath.startsWith(normalizePath(protected) + "/")
      );

      if (!user && isProtected) {
        console.log("🔐 Not signed in → redirecting to login");

        const redirectParam = encodeURIComponent(window.location.pathname);

        // Optional: scroll to top for UX polish
        window.scrollTo({ top: 0, behavior: "smooth" });

        // Redirect to login page with original page as query param
        window.location.href = `/login/?redirect=${redirectParam}`;
      }
    });
  };

  waitForFirebase();
});
