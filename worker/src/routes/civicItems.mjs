// worker/src/routes/civicItems.mjs
import { summarizeCivicItem } from "../lib/civicSummaries.mjs";
import { withCORS } from "../utils/cors.js";

const SELECT_SQL = `
  SELECT id, kind, source, level, jurisdiction_key, bill_number, title,
         summary, status, legislative_session, chamber, ballot_type,
         measure_code, election_date, external_ref_id, external_url, text_url,
         category, subject_tags, location_label, introduced_at, last_action,
         last_action_date, created_at, updated_at, up_votes, down_votes,
         summary_ai, summary_status, summary_updated_at
    FROM civic_items
   WHERE id = ?`;

const UPDATE_SQL = `
  UPDATE civic_items
     SET summary_ai = ?,
         summary_status = ?,
         summary_updated_at = ?
   WHERE id = ?`;

export async function handleGetCivicItem(request, env) {
  const id = request.params?.id;
  if (!id) {
    return withCORS(
      JSON.stringify({ error: "Missing civic item id" }),
      400,
      { "Content-Type": "application/json" },
      request
    );
  }

  try {
    const stmt = env.WY_DB.prepare(SELECT_SQL).bind(id);
    const { results } = await stmt.all();
    if (!results || results.length === 0) {
      return withCORS(
        JSON.stringify({ error: "Not found" }),
        404,
        { "Content-Type": "application/json" },
        request
      );
    }

    let row = results[0];

    // If already summarized, return as-is
    if (row.summary_status === "ready" && row.summary_ai) {
      return withCORS(JSON.stringify(row), 200, {
        "Content-Type": "application/json",
      });
    }

    // Only summarize when missing/error
    try {
      const { summaryText, meta } = await summarizeCivicItem(env, row);
      const now = new Date().toISOString();

      await env.WY_DB.prepare(UPDATE_SQL)
        .bind(summaryText, "ready", now, id)
        .run();

      row = { ...row, summary_ai: summaryText, summary_status: "ready", summary_updated_at: now, ai_meta: meta };
      return withCORS(JSON.stringify(row), 200, {
        "Content-Type": "application/json",
      });
    } catch (aiErr) {
      console.error("❌ summarizeCivicItem failed:", aiErr);
      await env.WY_DB.prepare(UPDATE_SQL)
        .bind(row.summary_ai || null, "error", new Date().toISOString(), id)
        .run();

      return withCORS(
        JSON.stringify({
          ...row,
          summary_status: "error",
          ai_error: "summarization_failed",
        }),
        200,
        { "Content-Type": "application/json" },
        request
      );
    }
  } catch (err) {
    console.error("❌ handleGetCivicItem error:", err);
    return withCORS(
      JSON.stringify({ error: "Internal server error" }),
      500,
      { "Content-Type": "application/json" },
      request
    );
  }
}
