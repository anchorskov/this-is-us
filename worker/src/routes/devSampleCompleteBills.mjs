// worker/src/routes/devSampleCompleteBills.mjs
// DEV: Return a sample of civic_items that meet completeness criteria.

import { withCORS } from "../utils/cors.js";
import { isCivicItemComplete } from "../lib/civicItemCompleteness.mjs";

export async function handleDevSampleCompleteBills(request, env) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || "5");
    const { results = [] } = await env.WY_DB.prepare(
      `SELECT ci.*, 
              (SELECT COUNT(*) FROM bill_sponsors bs WHERE bs.civic_item_id = ci.id) AS sponsor_count
         FROM civic_items ci
        WHERE ci.jurisdiction_key = 'WY' AND ci.level = 'statewide'
        ORDER BY ci.updated_at DESC
        LIMIT ?`
    )
      .bind(limit)
      .all();

    const complete = results.filter((row) =>
      isCivicItemComplete(row, { sponsorCount: row.sponsor_count })
    );

    return withCORS(
      JSON.stringify({ count: complete.length, results: complete }),
      200,
      { "Content-Type": "application/json" }
    );
  } catch (err) {
    console.error("❌ sample complete bills failed:", err);
    return withCORS(
      JSON.stringify({ error: "sample_failed", message: err.message }),
      500,
      { "Content-Type": "application/json" }
    );
  }
}
