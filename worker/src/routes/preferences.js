import { handlePreferencesRequest } from "../account/preferences.js";
import { handleCORSPreflight }      from "../utils/cors.js";

/* Register /api/preferences routes */
export function register(router) {
  router
    .options("/api/preferences", handleCORSPreflight)
    .post   ("/api/preferences", handlePreferencesRequest);
}
