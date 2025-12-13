// worker/src/routes/api/user-topics/index.js
import { getUserId }                     from "../../../lib/auth.js";
import { withCORS, handleCORSPreflight } from "../../../utils/cors.js";

/* ── Pre-flight CORS ──────────────────────────────────────────────── */
export function OPTIONS(request) {
  return handleCORSPreflight(request);
}

/* ── GET /api/user-topics ────────────────────────────────────────── */
export async function GET(request, env) {
  try {
    const uid = await getUserId(request, env);

    const { results } = await env.EVENTS_DB.prepare(`
      SELECT ht.id,
             ht.title AS name,
             ht.slug,
             CASE WHEN utp.topic_id IS NULL THEN 0 ELSE 1 END AS checked,
             COALESCE(utp.updated_at,'') AS updated_at
      FROM   hot_topics ht
      LEFT  JOIN user_topic_prefs utp
             ON utp.topic_id = ht.id
            AND utp.user_id  = ?1
      WHERE ht.is_active = 1
      ORDER BY ht.priority ASC, ht.title;`)
      .bind(uid)
      .all();

    /* Always return CORS-safe response */
    return withCORS(
      JSON.stringify(results),
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
      await env.EVENTS_DB.prepare(
        "INSERT OR IGNORE INTO user_topic_prefs (user_id, topic_id) VALUES (?1, ?2);"
      ).bind(uid, topicId).run();
    } else {
      await env.EVENTS_DB.prepare(
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
