// worker/src/routes/townhall/posts.mjs
// Town Hall threads and replies – D1 backed (EVENTS_DB) with verified voter gating via WY_DB.verified_users.

import { requireAuth } from "../../auth/verifyFirebaseOrAccess.mjs";
import { withCORS } from "../../utils/cors.js";

const OK_HEADERS = { "Content-Type": "application/json" };

async function getVerified(env, userId) {
  const { results = [] } = await env.WY_DB.prepare(
    `SELECT voter_id, county, house, senate, status
       FROM verified_users
      WHERE user_id = ?1 AND status = 'verified'
      LIMIT 1`
  )
    .bind(userId)
    .all();
  return results[0] || null;
}

export async function handleListTownhallThreads(request, env) {
  try {
    const url = new URL(request.url);
    const county = url.searchParams.get("county");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);

    let sql = `SELECT id, user_id, voter_id, county, title, prompt, bill_id, topic_slugs, created_at
                 FROM townhall_posts`;
    const params = [];
    if (county) {
      sql += ` WHERE county = ?`;
      params.push(county);
    }
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const { results = [] } = await env.EVENTS_DB.prepare(sql).bind(...params).all();

    const threads = results.map((r) => ({
      id: r.id,
      title: r.title,
      prompt: r.prompt,
      county: r.county || null,
      bill_id: r.bill_id || null,
      topic_slugs: r.topic_slugs || null,
      created_at: r.created_at,
      snippet: r.prompt ? r.prompt.slice(0, 180) : "",
    }));

    return withCORS(JSON.stringify({ results: threads }), 200, OK_HEADERS, request);
  } catch (err) {
    console.error("❌ list townhall threads error:", err);
    return withCORS(JSON.stringify({ error: "Internal server error" }), 500, OK_HEADERS, request);
  }
}

export async function handleCreateTownhallThread(request, env) {
  try {
    const identity = await requireAuth(request, env);
    let body = {};
    try {
      body = await request.json();
    } catch {
      return withCORS(JSON.stringify({ error: "Invalid JSON body" }), 400, OK_HEADERS, request);
    }
    const title = (body.title || "").trim();
    const prompt = (body.prompt || "").trim();
    const bill_id = body.bill_id || null;
    const topic_slugs = body.topic_slugs || null;

    if (!title || !prompt) {
      return withCORS(
        JSON.stringify({
          error: "Invalid request",
          details: { title: "required", prompt: "required" },
        }),
        400,
        OK_HEADERS,
        request
      );
    }

    const verified = await getVerified(env, identity.uid);
    if (!verified) {
      return withCORS(
        JSON.stringify({
          error: "not_verified",
          message: "Verified county voter account required to post in this Town Hall.",
        }),
        403,
        OK_HEADERS,
        request
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await env.EVENTS_DB.prepare(
      `INSERT INTO townhall_posts
         (id, user_id, voter_id, county, title, prompt, bill_id, topic_slugs, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
      .bind(
        id,
        identity.uid,
        verified.voter_id,
        verified.county,
        title,
        prompt,
        bill_id,
        topic_slugs,
        now
      )
      .run();

    return withCORS(JSON.stringify({ thread_id: id, created_at: now }), 201, OK_HEADERS, request);
  } catch (err) {
    if (err?.status === 401) throw err; // let requireAuth propagate
    console.error("❌ create townhall thread error:", err);
    return withCORS(JSON.stringify({ error: "Internal server error" }), 500, OK_HEADERS, request);
  }
}

export async function handleGetTownhallThread(request, env) {
  try {
    const { id } = request.params || {};
    if (!id) {
      return withCORS(JSON.stringify({ error: "Missing thread id" }), 400, OK_HEADERS, request);
    }

    const threadRow = await env.EVENTS_DB.prepare(
      `SELECT id, user_id, voter_id, county, title, prompt, bill_id, topic_slugs, created_at
         FROM townhall_posts
        WHERE id = ?1
        LIMIT 1`
    )
      .bind(id)
      .first();

    if (!threadRow) {
      return withCORS(JSON.stringify({ error: "Not found" }), 404, OK_HEADERS, request);
    }

    const { results: replies = [] } = await env.EVENTS_DB.prepare(
      `SELECT id, thread_id, author_user_id, author_voter_id, body, created_at, status, parent_reply_id
         FROM townhall_replies
        WHERE thread_id = ?1 AND status = 'active'
        ORDER BY created_at ASC`
    )
      .bind(id)
      .all();

    return withCORS(
      JSON.stringify({
        thread: threadRow,
        replies,
      }),
      200,
      OK_HEADERS,
      request
    );
  } catch (err) {
    console.error("❌ get townhall thread error:", err);
    return withCORS(JSON.stringify({ error: "Internal server error" }), 500, OK_HEADERS, request);
  }
}

export async function handleCreateTownhallReply(request, env) {
  try {
    const { id: threadId } = request.params || {};
    if (!threadId) {
      return withCORS(JSON.stringify({ error: "Missing thread id" }), 400, OK_HEADERS, request);
    }

    const identity = await requireAuth(request, env);
    const verified = await getVerified(env, identity.uid);
    if (!verified) {
      return withCORS(
        JSON.stringify({
          error: "not_verified",
          message: "Verified county voter account required to reply in this Town Hall.",
        }),
        403,
        OK_HEADERS,
        request
      );
    }

    let bodyJson = {};
    try {
      bodyJson = await request.json();
    } catch {
      return withCORS(JSON.stringify({ error: "Invalid JSON body" }), 400, OK_HEADERS, request);
    }
    const body = (bodyJson.body || "").trim();
    if (!body) {
      return withCORS(
        JSON.stringify({ error: "Invalid request", details: { body: "required" } }),
        400,
        OK_HEADERS,
        request
      );
    }

    // Optional: enforce county match
    const thread = await env.EVENTS_DB.prepare(
      `SELECT id, county FROM townhall_posts WHERE id = ?1 LIMIT 1`
    )
      .bind(threadId)
      .first();
    if (!thread) {
      return withCORS(JSON.stringify({ error: "Not found" }), 404, OK_HEADERS, request);
    }
    if (thread.county && verified.county && thread.county !== verified.county) {
      return withCORS(
        JSON.stringify({
          error: "not_verified",
          message: "Replies must match the thread's county.",
        }),
        403,
        OK_HEADERS,
        request
      );
    }

    const replyId = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.EVENTS_DB.prepare(
      `INSERT INTO townhall_replies
         (id, thread_id, author_user_id, author_voter_id, body, created_at, status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active')`
    )
      .bind(replyId, threadId, identity.uid, verified.voter_id, body, now)
      .run();

    return withCORS(
      JSON.stringify({
        id: replyId,
        thread_id: threadId,
        author_user_id: identity.uid,
        author_voter_id: verified.voter_id,
        body,
        created_at: now,
        status: "active",
      }),
      201,
      OK_HEADERS,
      request
    );
  } catch (err) {
    if (err?.status === 401) throw err;
    console.error("❌ create townhall reply error:", err);
    return withCORS(JSON.stringify({ error: "Internal server error" }), 500, OK_HEADERS, request);
  }
}

// Manual test notes (curl):
// curl -s "http://127.0.0.1:8787/api/townhall/posts?limit=5"
// curl -s -X POST "http://127.0.0.1:8787/api/townhall/posts" -H "Authorization: Bearer TOKEN" \
//      -H "Content-Type: application/json" \
//      -d '{"title":"Test thread","prompt":"Body text"}'
// curl -s "http://127.0.0.1:8787/api/townhall/posts/THREAD_ID"
// curl -s -X POST "http://127.0.0.1:8787/api/townhall/posts/THREAD_ID/replies" \
//      -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
//      -d '{"body":"Reply text"}'
