/* worker/src/account/preferences.js
   ---------------------------------------------------------------
   Handles /api/preferences  (GET, POST)
   --------------------------------------------------------------- */

import { verifySession } from "../lib/auth.js";

/* ––––– utility ––––– */
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

export async function handlePreferencesRequest(request, env) {
  const { user } = await verifySession(request);

  /* 401 if not logged-in OR e-mail not verified */
  if (!user || !user.email_verified) {
    return json({ error: "unauthorized" }, 401);
  }

  const db = env.EVENTS_DB;

  /* ────────────────  GET  ─────────────────────────────────── */
  if (request.method === "GET") {
    return handleGetPrefs(user.uid, db);
  }

  /* ────────────────  POST  ────────────────────────────────── */
  if (request.method === "POST") {
    const body = await request.json();

    /* 1.  New-topic request → moderation queue */
    if (body.newTopic) {
      await db
        .prepare(
          `INSERT INTO topic_requests (user_id, user_email, proposed_name)
           VALUES (?, ?, ?)`
        )
        .bind(user.uid, user.email, body.newTopic)
        .run();

      return json({ ok: true, queued: true });
    }

    /* 2.  Save (overwrite) user selections */
    return savePreferences(user.uid, body.selected, db);
  }

  /* fallback */
  return json({ error: "method not allowed" }, 405, {
    Allow: "GET, POST",
  });
}

/* ──────────────────────────────────────────────────────────── */
/* GET helper – returns { topics:[…], firstTime:boolean }      */
export async function handleGetPrefs(userId, db) {
  const query = `
    SELECT
      t.id,
      t.name,
      t.slug,
      CASE WHEN p.topic_id IS NOT NULL THEN 1 ELSE 0 END AS interested
    FROM topic_index t
    LEFT JOIN user_topic_prefs p
      ON t.id = p.topic_id
     AND p.user_id = ?
    ORDER BY t.name;`;

  const { results: topics } = await db.prepare(query).bind(userId).all();
  const firstTime = topics.every((t) => t.interested === 0);

  return json({ topics, firstTime });
}

/* ──────────────────────────────────────────────────────────── */
/* POST helper – replace user prefs in one txn                 */
export async function savePreferences(userId, topicIds, db) {
  if (!Array.isArray(topicIds)) {
    return json({ error: "invalid input" }, 400);
  }

  /* wrap in explicit transaction */
  const txn = db.transaction(async (tx) => {
    await tx
      .prepare(`DELETE FROM user_topic_prefs WHERE user_id = ?`)
      .bind(userId)
      .run();

    for (const id of topicIds) {
      await tx
        .prepare(
          `INSERT INTO user_topic_prefs (user_id, topic_id)
             VALUES (?, ?)`
        )
        .bind(userId, id)
        .run();
    }
  });

  await txn.run();
  return json({ ok: true });
}
