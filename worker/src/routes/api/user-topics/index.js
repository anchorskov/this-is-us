// worker/src/routes/api/user-topics/index.js
import { getUserId }                     from "../../../lib/auth.js";
import { withCORS, handleCORSPreflight } from "../../../utils/cors.js";
import { hasColumn } from "../../../lib/dbHelpers.mjs";

export function dedupeTopics(rows = []) {
  const seen = new Set();
  const deduped = [];
  for (const row of rows) {
    const key = row.slug || row.name || row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped;
}

/* ── Pre-flight CORS ──────────────────────────────────────────────── */
export function OPTIONS(request) {
  return handleCORSPreflight(request);
}

/* ── GET /api/user-topics ────────────────────────────────────────── */
export async function GET(request, env) {
  try {
    const uid = await getUserId(request, env);
    const url = new URL(request.url);
    const sessionParam = url.searchParams.get("session");
    const hasSession = await hasColumn(env.WY_DB, "hot_topics", "legislative_session");
    const hasDescription = await hasColumn(env.WY_DB, "hot_topics", "description");
    const hasInvalidated = await hasColumn(env.WY_DB, "hot_topics", "invalidated");
    let session = sessionParam;
    if (!session && hasSession) {
      const latest = await env.WY_DB.prepare(
        "SELECT MAX(legislative_session) AS session FROM hot_topics WHERE legislative_session IS NOT NULL"
      ).first();
      session = latest?.session || null;
    }

    const descriptionSelect = hasDescription ? "ht.description" : "NULL AS description";
    const sessionFilter = hasSession && session ? "AND ht.legislative_session = ?2" : "";
    const invalidatedFilter = hasInvalidated ? "AND ht.invalidated = 0" : "";
    const sessionSelect = hasSession ? "ht.legislative_session" : "NULL AS legislative_session";
    const sql = `
      SELECT ht.id,
             ht.title AS name,
             ht.slug,
             ${descriptionSelect},
             ht.summary,
             ${sessionSelect},
             CASE WHEN utp.topic_id IS NULL THEN 0 ELSE 1 END AS checked,
             COALESCE(utp.updated_at,'') AS updated_at
      FROM   hot_topics ht
      LEFT  JOIN user_topic_prefs utp
             ON utp.topic_id = ht.id
            AND utp.user_id  = ?1
      WHERE ht.is_active = 1
      ${invalidatedFilter}
      ${sessionFilter}
      ORDER BY ht.priority ASC, ht.title;
    `;
    const bindParams = hasSession && session ? [uid, session] : [uid];
    const { results } = await env.WY_DB.prepare(sql).bind(...bindParams).all();
    const normalized = (results || []).map((row) => ({
      ...row,
      description: row.description || row.summary || "",
    }));
    const deduped = dedupeTopics(normalized);

    /* Always return CORS-safe response */
    return withCORS(
      JSON.stringify(deduped),
      200,
      { "Content-Type": "application/json" },
      request
    );
  } catch (err) {
    if (err instanceof Response) {
      return err; // Pass through Response errors (like 401 from getUserId)
    }
    console.error("GET /api/user-topics error:", err);
    return withCORS(
      JSON.stringify({ error: err.message }),
      500,
      { "Content-Type": "application/json" },
      request
    );
  }
}

/* ── POST /api/user-topics ───────────────────────────────────────── */
export async function POST(request, env) {
  try {
    const uid                  = await getUserId(request, env);
    const { topicId, checked } = await request.json();

    if (checked) {
      await env.WY_DB.prepare(
        "INSERT OR IGNORE INTO user_topic_prefs (user_id, topic_id) VALUES (?1, ?2);"
      ).bind(uid, topicId).run();
    } else {
      await env.WY_DB.prepare(
        "DELETE FROM user_topic_prefs WHERE user_id = ?1 AND topic_id = ?2;"
      ).bind(uid, topicId).run();
    }

    return withCORS("ok", 200, {}, request);
  } catch (err) {
    if (err instanceof Response) {
      return err; // Pass through Response errors (like 401 from getUserId)
    }
    console.error("POST /api/user-topics error:", err);
    return withCORS(
      JSON.stringify({ error: err.message }),
      500,
      { "Content-Type": "application/json" },
      request
    );
  }
}

export default { OPTIONS, GET, POST };
