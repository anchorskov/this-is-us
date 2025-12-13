// worker/src/routes/internalVerifyBill.mjs
// Internal route to sanity-check a bill's topic + summary using gpt-4o-mini.

import { withCORS } from "../utils/cors.js";
import { reviewCivicItem } from "../lib/civicReviewPipeline.mjs";

function jsonResponse(body, status = 200, request) {
  return withCORS(JSON.stringify(body), status, {
    "Content-Type": "application/json",
  }, request);
}

export async function handleInternalVerifyBill(request, env) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return jsonResponse({ error: "id query param required" }, 400, request);
    }

    const result = await reviewCivicItem(env, id);
    return jsonResponse({ verification: result }, 200, request);
  } catch (err) {
    console.error("❌ handleInternalVerifyBill error:", err);
    return jsonResponse(
      { error: "verification_failed", message: err.message },
      500,
      request
    );
  }
}

// Dev helper (local):
// curl "http://127.0.0.1:8787/api/internal/civic/verify-bill?id=test-hb164"
