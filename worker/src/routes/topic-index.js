/* worker/src/routes/topic-index.js – TEMP public read-only list */
import { withCORS } from "../utils/cors.js";

export async function handlePublicTopicIndex(request, env) {
  const { results } = await env.EVENTS_DB
    .prepare("SELECT id, name, slug FROM topic_index ORDER BY name;")
    .all();

  return withCORS(JSON.stringify(results), 200, {
    "Content-Type": "application/json",
  });
}
