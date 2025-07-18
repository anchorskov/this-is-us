/* firebase-auth-guard.js – final minimal v9 */
import {
  getApps
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

/* Bail if app didn't initialise */
if (!getApps().length) {
  console.warn("⚠️ Firebase app missing – auth guard skipped.");
}

/* Paths that need a signed-in user */
const NEED_AUTH = [
  "/townhall",
  "/events/create",
  "/account",
  "/admin",
  "/sandbox"
].map((p) => p.replace(/\/+$/, ""));

/* Only run redirect logic once */
let redirected = false;

onAuthStateChanged(getAuth(), (user) => {
  if (redirected) return; // stop double redirects

  const path = location.pathname.replace(/\/+$/, "");
  const mustAuth = NEED_AUTH.some(
    (root) => path === root || path.startsWith(root + "/")
  );

  if (!user && mustAuth) {
    redirected = true;
    console.log("🔐 redirecting anonymous user → /login/");
    const q = encodeURIComponent(location.pathname + location.search);
    if (!location.pathname.startsWith("/account")) {
      sessionStorage.setItem("redirectAfterLogin", location.pathname);
    }
    if (!window.location.pathname.startsWith("/login")) {
      location.href = `/login/?redirect=${q}`;
    }
  }
});
