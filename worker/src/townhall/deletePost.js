// worker/src/townhall/deletePost.js

export async function handleDeleteTownhallPost(request, env) {
  try {
    const form = await request.formData();
    const id = form.get('id');
    const userId = form.get('user_id'); // required
    const userRole = form.get('role') || 'citizen'; // optional but recommended

    if (!id || !userId) {
      return new Response(JSON.stringify({ error: 'Missing post ID or user ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch the post
    const { results } = await env.EVENTS_DB.prepare(`
      SELECT user_id, r2_key FROM townhall_posts WHERE id = ?
    `).bind(id).all();

    if (results.length === 0) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const post = results[0];

    // Authorization check
    const isOwner = post.user_id === userId;
    const isAdmin = userRole.toLowerCase() === 'admin';

    if (!isOwner && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("❌ Deletion error:", err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
