// worker/src/routes/civicVotes.mjs
// Simple thumbs up/down for civic_items stored in WY_DB

import { withCORS } from "../utils/cors.js";

const OK_HEADERS = { "Content-Type": "application/json" };

export async function handleVoteCivicItem(request, env) {
  try {
    const id = request.params?.id;
    if (!id) {
      return withCORS(JSON.stringify({ error: "Missing civic item id" }), 400, OK_HEADERS, request);
    }

    let body = {};
    try {
      body = await request.json();
    } catch (err) {
      return withCORS(JSON.stringify({ error: "Invalid JSON body" }), 400, OK_HEADERS, request);
    }

    const vote = (body.vote || "").toLowerCase();
    const userId = (body.user_id || "").trim();
    if (!["up", "down", "info"].includes(vote)) {
      return withCORS(JSON.stringify({ error: "vote must be 'up', 'down', or 'info'" }), 400, OK_HEADERS, request);
    }
    if (!userId) {
      return withCORS(JSON.stringify({ error: "user_id is required to vote" }), 400, OK_HEADERS, request);
    }

    const value = vote === "up" ? 1 : vote === "down" ? -1 : 0;

    const upsertSql = `
      INSERT INTO votes (user_id, target_type, target_id, value, created_at, updated_at)
      VALUES (?1, 'civic_item', ?2, ?3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, target_type, target_id)
      DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `;

    const selectSql = `
      SELECT target_id AS civic_item_id,
             SUM(value = 1)  AS up_votes,
             SUM(value = -1) AS down_votes,
             SUM(value = 0)  AS info_votes
        FROM votes
       WHERE target_type = 'civic_item'
         AND target_id = ?
       GROUP BY target_id`;

    await env.WY_DB.prepare(upsertSql).bind(userId, id, value).run();
    const { results = [] } = await env.WY_DB.prepare(selectSql).bind(id).all();
    const counts = results[0] || { up_votes: 0, down_votes: 0, info_votes: 0 };

    return withCORS(JSON.stringify(counts), 200, OK_HEADERS, request);
  } catch (err) {
    console.error("❌ handleVoteCivicItem error:", err);
    return withCORS(JSON.stringify({ error: "Internal server error" }), 500, OK_HEADERS, request);
  }
}
