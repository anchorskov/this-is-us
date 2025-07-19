// worker/src/routes/api/user-topics/index.js
import { getUserId }                     from "../../../lib/auth.js";
import { withCORS, handleCORSPreflight } from "../../../utils/cors.js";

/* ── Pre-flight CORS ──────────────────────────────────────────────── */
export function OPTIONS(request) {
  return handleCORSPreflight(request);
}

/* ── GET /api/user-topics ────────────────────────────────────────── */
export async function GET(request, env) {
  const uid = await getUserId(request, env);

  const { results } = await env.EVENTS_DB.prepare(`
    SELECT t.id,
           t.name,
           t.slug,
           CASE WHEN ut.topic_id IS NULL THEN 0 ELSE 1 END AS checked,
           COALESCE(ut.updated_at,'') AS updated_at
    FROM   topic_index t
    LEFT  JOIN user_topic_prefs ut
           ON ut.topic_id = t.id
          AND ut.user_id  = ?1
    ORDER BY t.name;`)
    .bind(uid)
    .all();

  /* Always return CORS-safe response */
  return withCORS(
    JSON.stringify(results),
    200,
    { "Content-Type": "application/json" },
    request
  );
}

/* ── POST /api/user-topics ───────────────────────────────────────── */
export async function POST(request, env) {
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
}

export default { OPTIONS, GET, POST };
