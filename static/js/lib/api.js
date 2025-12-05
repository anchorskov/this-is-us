import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { apiRoot } from "/js/lib/api-root.js";

export async function apiFetch(path, opts = {}) {
  const user = getAuth().currentUser;
  const id   = user ? await user.getIdToken() : null;

  opts.headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
    ...(id ? { Authorization: `Bearer ${id}` } : {}),
  };
  const root = typeof apiRoot === "function" ? apiRoot() : "/api";
  return fetch(`${root}${path}`, opts);
}
