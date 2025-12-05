// worker/src/townhall/deletePost.js

import { requireAuth } from "../auth/verifyFirebaseOrAccess.mjs";
import { withRestrictedCORS, TOWNHALL_ALLOWED_ORIGINS } from "../utils/cors.js";

export async function handleDeleteTownhallPost(request, env) {
  try {
    const identity = await requireAuth(request, env);
    const form = await request.formData();
    const id = form.get('id');
    const userId = identity.uid; // enforced server-side
    const userRole = form.get('role') || (identity.source === "access" ? "admin" : "citizen");

    if (!id || !userId) {
      return withRestrictedCORS(
        JSON.stringify({ error: 'Missing post ID or user ID' }),
        400,
        { 'Content-Type': 'application/json' },
        request,
        TOWNHALL_ALLOWED_ORIGINS
      );
    }

    // Fetch the post
    const { results } = await env.EVENTS_DB.prepare(`
      SELECT user_id, r2_key FROM townhall_posts WHERE id = ?
    `).bind(id).all();

    if (results.length === 0) {
      return withRestrictedCORS(
        JSON.stringify({ error: 'Post not found' }),
        404,
        { 'Content-Type': 'application/json' },
        request,
        TOWNHALL_ALLOWED_ORIGINS
      );
    }

    const post = results[0];

    // Authorization check
    const isOwner = post.user_id === userId;
    const isAdmin = userRole.toLowerCase() === 'admin';

    if (!isOwner && !isAdmin) {
      return withRestrictedCORS(
        JSON.stringify({ error: 'Unauthorized' }),
        403,
        { 'Content-Type': 'application/json' },
        request,
        TOWNHALL_ALLOWED_ORIGINS
      );
    }

    // Delete from R2 if exists
    if (post.r2_key) {
      try {
        await env.EVENT_PDFS.delete(post.r2_key);
        console.log(`🧹 Deleted R2 asset: ${post.r2_key}`);
      } catch (e) {
        console.warn(`⚠️ Failed to delete R2 asset ${post.r2_key}`, e);
      }
    }

    // Delete from D1
    await env.EVENTS_DB.prepare(
      `DELETE FROM townhall_posts WHERE id = ?`
    ).bind(id).run();

    return withRestrictedCORS(
      JSON.stringify({ success: true }),
      200,
      { 'Content-Type': 'application/json' },
      request,
      TOWNHALL_ALLOWED_ORIGINS
    );

  } catch (err) {
    console.error("❌ Deletion error:", err);
    return withRestrictedCORS(
      JSON.stringify({ error: 'Internal server error' }),
      500,
      { 'Content-Type': 'application/json' },
      request,
      TOWNHALL_ALLOWED_ORIGINS
    );
  }
}
