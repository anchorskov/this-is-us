// worker/src/routes/pendingBills.mjs
import { withCORS } from "../utils/cors.js";

export async function handlePendingBills(request, env) {
  try {
    const url = new URL(request.url);
    const session = url.searchParams.get("session");

    let sql = `
      SELECT id, bill_number, title, summary, status, legislative_session,
             chamber, category, last_action, last_action_date, external_url
        FROM civic_items
       WHERE kind = 'bill'
         AND level = 'statewide'
         AND jurisdiction_key = 'WY'
         AND status IN ('introduced','in_committee','pending_vote')
    `;
    const params = [];
    if (session) {
      sql += " AND legislative_session = ?";
      params.push(session);
    }
    sql += " ORDER BY last_action_date DESC, bill_number";

    const { results } = await env.WY_DB.prepare(sql).bind(...params).all();
    return withCORS(JSON.stringify({ results }), 200, {
      "Content-Type": "application/json",
    });
  } catch (err) {
    console.error("❌ handlePendingBills error:", err);
    return withCORS(
      JSON.stringify({ error: "Internal server error" }),
      500,
      { "Content-Type": "application/json" },
      request
    );
  }
}
