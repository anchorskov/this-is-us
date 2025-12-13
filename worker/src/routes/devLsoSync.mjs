// worker/src/routes/devLsoSync.mjs
// DEV: Sync Wyoming LSO committee bills into civic_items.

import { withCORS } from "../utils/cors.js";
import { syncLsoCommitteeBillsToCivicItems } from "../lib/wyLsoClient.mjs";

export async function handleDevLsoSync(request, env) {
  try {
    const url = new URL(request.url);
    const year = url.searchParams.get("year") || new Date().getFullYear();
    const result = await syncLsoCommitteeBillsToCivicItems(env, year);
    return withCORS(JSON.stringify(result), 200, {
      "Content-Type": "application/json",
    });
  } catch (err) {
    console.error("❌ LSO sync failed:", err);
    return withCORS(
      JSON.stringify({ error: "lso_sync_failed", message: err.message }),
      500,
      { "Content-Type": "application/json" }
    );
  }
}
