// ⬆️ Relative path: worker/src/routes/sync-user.js

import { upsertUserPreferences } from '../db/users.js';

export async function handleSyncUser(request, env) {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    const { uid, email, city, state } = await request.json();
    console.log("🛬 Incoming sync-user:", { uid, email, city, state });

    if (!uid || !email) {
      console.warn("⚠️ Missing uid or email");
      return new Response("Missing required fields", {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    await upsertUserPreferences(env, { uid, email, city, state });
    console.log("✅ User successfully synced to D1");

    return new Response("✅ User synced", {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" }
    });

  } catch (err) {
    console.error("❌ sync-user error:", err.stack || err.message || err);
    return new Response("Server error", {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
}
