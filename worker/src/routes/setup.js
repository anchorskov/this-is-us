import { withCORS } from "../utils/cors.js";
const json = d => withCORS(JSON.stringify(d), 200, { "Content-Type": "application/json" });

export function register(router) {
  router.post("/api/setup/topics", async ({ env }) => {
    const db = env.EVENTS_DB || env.DB;
    const { n } = await db.prepare("SELECT COUNT(*) AS n FROM topic_index").first();
    if (n) return json({ ok: true, alreadySeeded: n });

    await db.prepare(`
      INSERT INTO topic_index (name, slug) VALUES
      ('Public Safety','public-safety'),
      ('Infrastructure','infrastructure'),
      ('Parks & Rec','parks-rec')
    `).run();
    return json({ ok: true, seeded: 3 });
  });
}
