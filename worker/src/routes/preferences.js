/* worker/src/routes/preferences.js – mounts /api/preferences endpoints */

import { handlePreferencesRequest } from "../account/preferences.js";
import { handleCORSPreflight }      from "../utils/cors.js";

/**
 * register(router)
 *   Adds:
 *     • OPTIONS /api/preferences  (CORS pre-flight)
 *     • GET     /api/preferences
 *     • POST    /api/preferences
 */
export function register(router) {
  router
    .options("/api/preferences", handleCORSPreflight)
    .get    ("/api/preferences", handlePreferencesRequest)
    .post   ("/api/preferences", handlePreferencesRequest);
}
