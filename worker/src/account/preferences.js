// worker/src/account/preferences.js – patched 2025‑07‑17
// Uses single-context param and falls back to EVENTS_DB / DB / events_db_local binding.

import { withCORS } from "../utils/cors.js";

/* helper → CORS-wrapped JSON */
const json = (data, status = 200, extra = {}) =>
  withCORS(JSON.stringify(data), status, {
    "Content-Type": "application/json",
    ...extra,
  });

/* ------------- public entry that always wraps errors ------------- */
// Change 'c' to destructure 'request', 'env', 'ctx' directly
export async function handlePreferencesRequest(request, env, ctx) { // <--- CHANGED ARGUMENTS
  try {
    return await _handlePreferences({ request, env, ctx }); // Pass as an object to _handlePreferences if it expects one
  } catch (err) {
    console.error("🔥 prefs API crash:", err);
    // Ensure 500 errors also have CORS headers
    return json({ error: "server" }, 500); // still CORS-safe
  }
}

/* ------------------------- main logic ---------------------------- */
// This function can continue to expect a single object with { request, env, ctx }
async function _handlePreferences({ request, env, ctx }) { // <--- RETAINED OBJECT DESTRUCTURING
  // D1 binding fallback (dev = events_db_local, prod = EVENTS_DB)
  const db = env.EVENTS_DB || env.DB || env.events_db_local;
  if (!db) throw new Error("D1 binding not found (EVENTS_DB / DB / events_db_local)");

  // quick connectivity check
  try {
    await db.prepare("SELECT 1").all();
    console.log("✅ DB reachable");
  } catch (e) {
    console.error("❌ DB unreachable:", e);
    throw e; // bubbles up to 500
  }

  const method = request.method;
  console.log(`📥 ${method} /api/preferences`);

  // Handle GET requests for initial topic loading
  if (method === "GET") {
    const url = new URL(request.url);
    const uid = url.searchParams.get('uid'); // Get UID from query parameter
    if (!uid) return json({ error: "missing uid query param" }, 400);
    // Ensure userTopics returns a Response object wrapped with CORS
    return await userTopics(uid, db); 
  }

  // Handle POST requests for saving preferences or requesting new topics
  if (method === "POST") {
    const { uid, selected, newTopic } = await request.json();
    if (!uid) return json({ error: "missing uid in body" }, 400);

    /* 1️⃣ New Topic Request */
    if (newTopic) {
      await db
        .prepare(`INSERT INTO topic_requests (user_id, proposed_name) VALUES (?, ?)`)
        .bind(uid, newTopic)
        .run();
      console.log(`📬 topic request from ${uid}: "${newTopic}"`);
      return json({ ok: true, queued: true });
    }

    /* 2️⃣ Save Preferences */
    if (Array.isArray(selected)) {
      return savePrefs(uid, selected, db); 
    }

    // If it's a POST but neither newTopic nor selected is present, it's an invalid request for POST.
    return json({ error: "invalid POST request: missing selected or newTopic" }, 400);
  }

  return json({ error: "method not allowed" }, 405, { Allow: "GET, POST" });
}

/* ---------------- helper functions ---------------- */
async function publicTopics(db) {
  try {
    const { results } = await db
      .prepare(`SELECT id, name, slug FROM topic_index ORDER BY name`)
      .all();
    console.log("📤 public topics →", results.length, "rows");
    return json({ topics: results, firstTime: true }); 
  } catch (e) {
    console.error("❌ publicTopics SQL error:", e);
    throw e;
  }
}

async function userTopics(uid, db) {
  const q = `
    SELECT t.id, t.name, t.slug,
           CASE WHEN p.topic_id IS NOT NULL THEN 1 ELSE 0 END AS interested
      FROM topic_index t
    LEFT JOIN user_topic_prefs p ON t.id = p.topic_id AND p.user_id = ?
      ORDER BY t.name`;
  try {
    const { results } = await db.prepare(q).bind(uid).all();
    const firstTime = results.every(r => r.interested === 0);
    console.log(`📤 topics for ${uid} →`, results.length, "rows");
    return json({ topics: results, firstTime }); 
  } catch (e) {
    console.error("❌ userTopics SQL error:", e);
    throw e;
  }
}

async function savePrefs(uid, ids, db) {
  if (!Array.isArray(ids)) return json({ error: "invalid input" }, 400);

  const txn = db.transaction(async tx => {
    await tx
      .prepare(`DELETE FROM user_topic_prefs WHERE user_id = ?`)
      .bind(uid)
      .run();
    for (const id of ids) {
      await tx
        .prepare(`INSERT INTO user_topic_prefs (user_id, topic_id) VALUES (?,?)`)
        .bind(uid, id)
        .run();
    }
  });
  await txn.run();
  console.log(`💾 prefs saved for ${uid}:`, ids.length, "topics");
  return json({ ok: true }); 
}
