/**
 * adminIngestReset.mjs
 * 
 * POST /api/admin/ingest/reset
 * 
 * Protected endpoint to manually reset ingestion state.
 * Requires admin authentication or ADMIN_RESET_KEY header.
 * 
 * Query params:
 * - mode: "derived-only" (default) or "full-rebuild"
 */

import { withCORS } from "../utils/cors.js";
import { resetDerivedState, validateAdminAuth } from "../lib/ingestReset.mjs";

function json(data, status = 200, extra = {}) {
  return withCORS(JSON.stringify(data), status, {
    "Content-Type": "application/json",
    ...extra,
  });
}

export async function handleAdminIngestReset(request, env, ctx) {
  // Only allow POST
  if (request.method !== "POST") {
    return json({ error: "method not allowed" }, 405, { Allow: "POST" });
  }

  try {
    // Validate admin authentication
    const isProduction = env.ENVIRONMENT !== "development" && env.ENVIRONMENT !== "local";
    const adminAuthPassed = await validateAdminAuth(request, env);

    if (isProduction && !adminAuthPassed) {
      console.warn("⚠️ Unauthorized ingestion reset attempt");
      return json({ error: "unauthorized" }, 403);
    }

    // Get mode from query params
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") || "derived-only";

    if (!["derived-only", "full-rebuild"].includes(mode)) {
      return json({ 
        error: "invalid mode", 
        message: "mode must be 'derived-only' or 'full-rebuild'" 
      }, 400);
    }

    console.log(`🔄 Admin reset requested (mode: ${mode})`);

    // Get DB bindings
    const wyDb = env.WY_DB;
    const eventsDb = env.EVENTS_DB;

    if (!wyDb || !eventsDb) {
      return json({ 
        error: "database bindings missing",
        message: "WY_DB and EVENTS_DB bindings required"
      }, 500);
    }

    // Execute reset
    const resetResult = await resetDerivedState({
      mode,
      wyDb,
      eventsDb,
      isProduction,
      adminAuthPassed
    });

    const statusCode = resetResult.success ? 200 : 500;
    return json(resetResult, statusCode);

  } catch (err) {
    console.error("❌ Admin reset handler crashed:", err);
    return json({ 
      error: "server error", 
      message: err.message 
    }, 500);
  }
}

export function register(router) {
  router.post("/api/admin/ingest/reset", handleAdminIngestReset);
}
