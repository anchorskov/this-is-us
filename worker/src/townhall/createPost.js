// worker/src/townhall/createPost.js

export async function handleCreateTownhallPost(request, env) {
  const form = await request.formData();

  const userId    = form.get('user_id')    || 'anonymous';
  const title     = form.get('title')?.trim();
  const prompt    = form.get('prompt')?.trim();
  const file      = form.get('file');

  // Validate required field
  if (!title) {
    return new Response(JSON.stringify({ error: 'Missing title' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Limit file size to 2MB
  const MAX_SIZE = 2 * 1024 * 1024;
  let r2Key = null;
  let fileSize = 0;

  try {
    if (file && file.size > 0) {
      if (file.size > MAX_SIZE) {
        return new Response(JSON.stringify({ error: `File too large (max ${MAX_SIZE / (1024 * 1024)} MB)` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      fileSize = file.size;
      r2Key = `townhall-${crypto.randomUUID()}.pdf`;
      await env.EVENT_PDFS.put(r2Key, file.stream());
    }

    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days default

    await env.EVENTS_DB.prepare(`
      INSERT INTO townhall_posts (
        id, user_id, title, prompt, created_at,
        r2_key, file_size, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), userId, title, prompt,
      createdAt, r2Key, fileSize, expiresAt
    ).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("❌ Error creating post:", err.stack || err);
    return new Response(JSON.stringify({ error: 'Failed to create post' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
