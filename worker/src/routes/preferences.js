/**
 *  worker/src/routes/preferences.js
 *  Thin wrapper that plugs the preferences handler into an itty-router instance.
 */
import { handlePreferencesRequest } from "../account/preferences.js";

/**
 * register(router)
 *   Adds  GET /api/preferences
 *        POST /api/preferences
 */
export function register(router) {
  router
    .get ("/api/preferences", handlePreferencesRequest)
    .post("/api/preferences", handlePreferencesRequest);
}
