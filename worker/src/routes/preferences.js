//worker/src/routes/preferences.js
import { handlePreferencesRequest } from "../account/preferences.js";
import { handleCORSPreflight }  from "../utils/cors.js";

/* Register /api/preferences routes */
export function register(router) {
  router
    // Pre-flight CORS
    .options("/api/preferences", handleCORSPreflight)

    // Retrieve existing preferences (GET)
    .get("/api/preferences", handlePreferencesRequest)

    // Create or update preferences (POST)
    .post("/api/preferences", handlePreferencesRequest);
}

