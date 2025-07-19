import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

export async function apiFetch(path, opts = {}) {
  const user = getAuth().currentUser;
  const id   = user ? await user.getIdToken() : null;

  opts.headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
    ...(id ? { Authorization: `Bearer ${id}` } : {}),
  };
const root = typeof apiRoot === "string" ? apiRoot : "/api";
return fetch(`${apiRoot}${path}`, opts);
}
