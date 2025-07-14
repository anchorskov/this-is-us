/* static/js/lib/api-root.js
   Returns the correct API base every time you call it. */
export function apiRoot() {
  return window.EVENTS_API_URL || "/api";
}
