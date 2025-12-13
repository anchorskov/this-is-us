// worker/src/townhall/createThread.mjs
// POST /api/townhall/posts — create a Town Hall thread in D1 (EVENTS_DB)
// Requires verified voter status via WY_DB.verified_users bridge table

import { requireAuth } from "../auth/verifyFirebaseOrAccess.mjs";
import { getVerifiedUser } from "./verifiedUserHelper.mjs";

const OK_HEADERS = { "Content-Type": "application/json" };

function validateBody(body) {
  const errors = {};
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state =
    typeof body.state === "string" && body.state.trim()
      ? body.state.trim()
      : "WY";

  if (!title) errors.title = "Title is required";
  if (!prompt) errors.prompt = "Prompt is required";

  return {
    errors,
    title,
    prompt,
    city,
    state,
  };
}

export async function handleCreateTownhallThread(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: OK_HEADERS,
    });
  }

  let identity;
  try {
    identity = await requireAuth(request, env);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", details: err?.message }),
      { status: 401, headers: OK_HEADERS }
    );
  }

  // Check verified voter status
  const verifiedUser = await getVerifiedUser(env, identity.uid);
  if (!verifiedUser) {
    return new Response(
      JSON.stringify({
        error: "not_verified",
        message: "Verified county voter account required to create Town Hall threads.",
      }),
      { status: 403, headers: OK_HEADERS }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: OK_HEADERS }
    );
  }

  const {
    errors,
    title,
    prompt,
    city,
    state,
  } = validateBody(body);

  if (Object.keys(errors).length > 0) {
    return new Response(
      JSON.stringify({ error: "Invalid request", details: errors }),
      { status: 400, headers: OK_HEADERS }
    );
  }

  const threadId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

  try {
    await env.EVENTS_DB.prepare(
      `INSERT INTO townhall_posts (
        id, user_id, title, prompt, created_at, r2_key, file_size, expires_at, city, state
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
      .bind(
        threadId,
        identity.uid,
        title,
        prompt,
        createdAt,
        null,           // r2_key (no file in JSON payload)
        null,           // file_size (no file in JSON payload)
        expiresAt,
        city || null,
        state
      )
      .run();

    return new Response(
      JSON.stringify({ thread_id: threadId, created_at: createdAt }),
      { status: 201, headers: OK_HEADERS }
    );
  } catch (err) {
    console.error("❌ Failed to create townhall thread:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: OK_HEADERS }
    );
  }
}
