// worker/src/routes/townhall/listPost.js

export async function handleListTownhallPosts(request, env) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50); // Max 50
    const after = url.searchParams.get('after'); // optional ISO timestamp

    let query = `SELECT id, user_id, title, prompt, created_at, r2_key, file_size, expires_at
                 FROM townhall_posts`;
    const bindings = [];

    if (after) {
      query += ` WHERE created_at < ?`;
      bindings.push(after);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    bindings.push(limit);

    const { results } = await env.EVENTS_DB.prepare(query).bind(...bindings).all();

    const origin = new URL(request.url).origin;

    const posts = results.map(p => ({
      id: p.id,
      user_id: p.user_id,
      title: p.title,
      prompt: p.prompt,
      created_at: p.created_at,
      file_url: p.r2_key ? `${origin}/api/events/pdf/${p.r2_key}` : null,
      file_size: p.file_size,
      expires_at: p.expires_at
    }));

    return new Response(JSON.stringify(posts), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("❌ Failed to list townhall posts:", err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
