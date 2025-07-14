/* worker/src/account/preferences.js – v2025-07-14 patched */

import { verifySession } from "../lib/auth.js";
import { withCORS }      from "../utils/cors.js";

/* helper → CORS-wrapped JSON */
const json = (data, status = 200, extra = {}) =>
  withCORS(JSON.stringify(data), status, {
    "Content-Type": "application/json",
    ...extra,
  });

/* ------------- public entry that always wraps errors ------------- */
export async function handlePreferencesRequest(c) {
  try {
    return await _handlePreferences(c);   // 🌳 normal flow
  } catch (err) {
    console.error("🔥 prefs API crash:", err);
    return json({ error: "server" }, 500);           // still CORS-safe
  }
}

/* ------------------------- main logic ---------------------------- */
async function _handlePreferences(c) {
  const { request, env } = c;
  console.log(
    `🛂 ${request.method} /api/preferences | has-auth-hdr:`,
    !!request.headers.get("Authorization")
  );

  /* session may be null when user not logged-in */
  let user = null;
  try { ({ user } = await verifySession(request)); } catch {/* guest */ }

  const db = env.EVENTS_DB;

  /* ────────  GET  (public) ──────── */
  if (request.method === "GET") {
    if (!user) return publicTopics(db);
    return userTopics(user.uid, db);
  }

  /* ──────── POST  (verified only) ──────── */
  if (request.method === "POST") {
    if (!user)                   return json({ error: "unauthorized" }, 401);
    if (user.email_verified === false)
                                 return json({ error: "unverified email" }, 401);

    const body = await request.json();

    /* 1️⃣  new-topic request */
    if (body.newTopic) {
      await db.prepare(
        `INSERT INTO topic_requests (user_id, user_email, proposed_name)
         VALUES (?,?,?)`
      ).bind(user.uid, user.email, body.newTopic).run();
      return json({ ok: true, queued: true });
    }

    /* 2️⃣  save selections */
    return savePrefs(user.uid, body.selected, db);
  }

  return json({ error: "method not allowed" }, 405, { Allow: "GET, POST" });
}

/* ---------------- helper functions ---------------- */
async function publicTopics(db) {
  const { results } =
    await db.prepare(`SELECT id, name, slug FROM topic_index ORDER BY name`).all();
  console.log("📤 public topics →", results.length, "rows");
  return json({ topics: results, firstTime: true });
}

async function userTopics(uid, db) {
  const q = `
    SELECT t.id, t.name, t.slug,
           CASE WHEN p.topic_id IS NOT NULL THEN 1 ELSE 0 END AS interested
      FROM topic_index t
      LEFT JOIN user_topic_prefs p ON t.id = p.topic_id AND p.user_id = ?
     ORDER BY t.name`;
  const { results } = await db.prepare(q).bind(uid).all();
  console.log(`📤 topics for ${uid} →`, results.length, "rows");
  const firstTime = results.every(r => r.interested === 0);
  return json({ topics: results, firstTime });
}

async function savePrefs(uid, ids, db) {
  if (!Array.isArray(ids)) return json({ error: "invalid input" }, 400);

  const txn = db.transaction(async tx => {
    await tx.prepare(`DELETE FROM user_topic_prefs WHERE user_id = ?`)
            .bind(uid).run();
    for (const id of ids) {
      await tx.prepare(
        `INSERT INTO user_topic_prefs (user_id, topic_id) VALUES (?,?)`
      ).bind(uid, id).run();
    }
  });
  await txn.run();
  console.log(`💾 prefs saved for ${uid}:`, ids.length, "topics");
  return json({ ok: true });
}
