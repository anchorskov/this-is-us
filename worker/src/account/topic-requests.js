import { verifySession } from "../lib/auth.js";
import { slugify } from "../lib/utils.js";

export async function handleTopicRequests(req, env) {
  const { user } = await verifySession(req);
  if (!user || !user.email_verified || !user.isAdmin) {
    return new Response("Unauthorized", { status: 403 });
  }

  if (req.method === "GET") {
    const { results } = await env.EVENTS_DB.prepare(`
      SELECT id, user_email, proposed_name
      FROM topic_requests
      WHERE status = 'pending'
      ORDER BY submitted_at ASC
    `).all();
    return Response.json(results);
  }

  if (req.method === "POST") {
    const { id, action } = await req.json();
    if (!id || !["approve", "reject"].includes(action)) {
      return new Response("Invalid input", { status: 400 });
    }

    if (action === "approve") {
      // insert into topic_index and update status
      const { results } = await env.EVENTS_DB.prepare(`
        SELECT proposed_name FROM topic_requests WHERE id = ? LIMIT 1
      `).bind(id).all();
      const name = results[0]?.proposed_name;
      if (!name) return new Response("Not found", { status: 404 });

      const slug = slugify(name);
      await env.EVENTS_DB.batch([
        env.EVENTS_DB.prepare(`
          INSERT OR IGNORE INTO topic_index (name, slug) VALUES (?, ?)
        `).bind(name, slug),
        env.EVENTS_DB.prepare(`
          UPDATE topic_requests SET status = 'approved' WHERE id = ?
        `).bind(id)
      ]);
    } else {
      await env.EVENTS_DB.prepare(`
        UPDATE topic_requests SET status = 'rejected' WHERE id = ?
      `).bind(id).run();
    }

    return new Response("OK");
  }

  return new Response("Method not allowed", { status: 405 });
}
