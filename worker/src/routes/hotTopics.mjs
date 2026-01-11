// worker/src/routes/hotTopics.mjs
// Hot topics endpoints for trending/featured civic issues

import { hasColumn } from "../lib/dbHelpers.mjs";

async function fetchCivicItems(env, civicIds) {
  if (!civicIds.length) return {};

  const placeholders = civicIds.map(() => "?").join(", ");
  const { results = [] } = await env.WY_DB.prepare(
    `SELECT ci.id,
            ci.bill_number,
            ci.title,
            ci.status,
            ci.legislative_session,
            ci.chamber,
            ci.last_action,
            ci.last_action_date,
            ci.ai_summary,
            ci.summary,
            COALESCE(v.up_votes, 0)   AS up_votes,
            COALESCE(v.down_votes, 0) AS down_votes,
            COALESCE(v.info_votes, 0) AS info_votes
       FROM civic_items ci
       LEFT JOIN (
         SELECT target_id,
                SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END)  AS up_votes,
                SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END) AS down_votes,
                SUM(CASE WHEN value = 0 THEN 1 ELSE 0 END)  AS info_votes
           FROM votes
          WHERE target_type = 'civic_item'
            AND target_id IN (${placeholders})
          GROUP BY target_id
       ) v ON v.target_id = ci.id
      WHERE ci.id IN (${placeholders})`
  )
    .bind(...civicIds, ...civicIds)
    .all();

  return results.reduce((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});
}

export async function handleListHotTopics(req, env) {
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";
    const session = url.searchParams.get("session");
    const hasSession = await hasColumn(env.WY_DB, "hot_topics", "legislative_session");
    const hasDescription = await hasColumn(env.WY_DB, "hot_topics", "description");
    const hasInvalidated = await hasColumn(env.WY_DB, "hot_topics", "invalidated");

    const topicParams = [];
    const hasLinkSession = await hasColumn(env.WY_DB, "hot_topic_civic_items", "legislative_session");
    const sessionJoin = session
      ? "AND ci.legislative_session = ? AND ci.inactive_at IS NULL"
      : "";
    if (session) topicParams.push(session);

    const descriptionSelect = hasDescription ? "ht.description" : "NULL AS description";
    const topicSessionFilter =
      session && hasSession ? "AND ht.legislative_session = ?" : "";
    const invalidatedFilter = hasInvalidated ? "AND ht.invalidated = 0" : "";
    if (session && hasSession) topicParams.push(session);

    const { results = [] } = await env.WY_DB.prepare(
      `SELECT ht.id, ht.slug, ht.title, ht.summary, ${descriptionSelect}, ht.badge, ht.image_url, ht.cta_label, ht.cta_url,
              ht.priority, ht.is_active, ht.created_at, ht.updated_at,
              COUNT(DISTINCT ci.id) AS bill_count
         FROM hot_topics ht
         LEFT JOIN hot_topic_civic_items htci ON htci.topic_id = ht.id
              ${session && hasLinkSession ? "AND htci.legislative_session = ?" : ""}
         LEFT JOIN civic_items ci ON ci.id = htci.civic_item_id
              ${sessionJoin}
        WHERE ht.is_active = 1
          ${invalidatedFilter}
          ${topicSessionFilter}
        GROUP BY ht.id
        ORDER BY ht.priority ASC, ht.created_at DESC`
    ).bind(...topicParams).all();

    if (debug) {
      console.log(`[HOT_TOPICS_DEBUG] SQL query returned ${results.length} topic rows`);
    }

    const topics = results.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      description: row.description || row.summary || "",
      badge: row.badge,
      image_url: row.image_url,
      cta_label: row.cta_label,
      cta_url: row.cta_url,
      priority: row.priority,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      bill_count: row.bill_count || 0,
      top_bills: [],
      civic_items: [],
    }));

    const topicById = new Map(topics.map((t) => [t.id, t]));

    const billParams = [];
    if (session) billParams.push(session);
    if (session && hasLinkSession) billParams.push(session);
    const billRows = await env.WY_DB.prepare(
      `SELECT ht.id AS topic_id,
              htc.confidence,
              ci.id AS civic_item_id,
              ci.bill_number,
              ci.title,
              ci.ai_summary,
              ci.summary,
              ci.external_url,
              ci.text_url
         FROM hot_topic_civic_items htc
         JOIN hot_topics ht ON ht.id = htc.topic_id
         JOIN civic_items ci ON ci.id = htc.civic_item_id
        WHERE ht.is_active = 1
          ${invalidatedFilter}
          ${session ? "AND ci.legislative_session = ? AND ci.inactive_at IS NULL" : ""}
          ${session && hasLinkSession ? "AND htc.legislative_session = ?" : ""}
        ORDER BY htc.confidence DESC, ci.last_action_date DESC`
    )
      .bind(...billParams)
      .all();

    const topLimit = 3;
    for (const row of billRows.results || []) {
      const topic = topicById.get(row.topic_id);
      if (!topic) continue;
      if (topic.top_bills.length >= topLimit) continue;
      topic.top_bills.push({
        id: row.civic_item_id,
        bill_number: row.bill_number,
        title: row.title,
        ai_summary: row.ai_summary || row.summary || "",
        external_url: row.external_url || null,
        text_url: row.text_url || null,
        confidence: row.confidence,
      });
      topic.civic_items = topic.top_bills;
    }

    if (debug) {
      console.log(`[HOT_TOPICS_DEBUG] Found ${topics.length} unique topics`);
    }

    if (debug) {
      const topicCounts = topics.map(t => `${t.title}:${t.civic_items.length}`).join(", ");
      console.log(`[HOT_TOPICS_DEBUG] Final response: ${topics.map(t => t.civic_items.length).reduce((a, b) => a + b, 0)} total civic_items across ${topics.length} topics`);
      console.log(`[HOT_TOPICS_DEBUG] Per-topic breakdown: ${topicCounts}`);
    }

    return new Response(JSON.stringify(topics), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error fetching hot topics:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function handleGetHotTopic(req, env) {
  const { slug } = req.params;

  try {
    const url = new URL(req.url);
    const session = url.searchParams.get("session");
    const hasSession = await hasColumn(env.WY_DB, "hot_topics", "legislative_session");
    const hasDescription = await hasColumn(env.WY_DB, "hot_topics", "description");
    const hasInvalidated = await hasColumn(env.WY_DB, "hot_topics", "invalidated");
    const hasLinkSession = await hasColumn(env.WY_DB, "hot_topic_civic_items", "legislative_session");

    const descriptionSelect = hasDescription ? "description" : "NULL AS description";
    const sessionFilter = session && hasSession ? "AND legislative_session = ?" : "";
    const invalidatedFilter = hasInvalidated ? "AND invalidated = 0" : "";
    const topicRow = await env.WY_DB.prepare(
      `SELECT id, slug, title, summary, ${descriptionSelect}, badge, image_url, cta_label, cta_url, priority, is_active, created_at, updated_at
         FROM hot_topics 
        WHERE slug = ? AND is_active = 1 ${invalidatedFilter} ${sessionFilter}`
    )
      .bind(slug, ...(session && hasSession ? [session] : []))
      .first();

    if (!topicRow) {
      return new Response(JSON.stringify({ error: "Topic not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const linkParams = [topicRow.id];
    let linkSessionFilter = "";
    if (session) {
      linkSessionFilter = "AND ci.legislative_session = ? AND ci.inactive_at IS NULL";
      linkParams.push(session);
      if (hasLinkSession) {
        linkSessionFilter += " AND htc.legislative_session = ?";
        linkParams.push(session);
      }
    }

    const { results = [] } = await env.WY_DB.prepare(
      `SELECT htc.civic_item_id,
              htc.confidence,
              ci.bill_number,
              ci.title,
              ci.ai_summary,
              ci.summary,
              ci.external_url,
              ci.text_url
         FROM hot_topic_civic_items htc
         JOIN civic_items ci ON ci.id = htc.civic_item_id
        WHERE htc.topic_id = ?
          ${linkSessionFilter}
        ORDER BY htc.confidence DESC, ci.last_action_date DESC`
    )
      .bind(...linkParams)
      .all();

    const civicItems = (results || []).map((row) => ({
      id: row.civic_item_id,
      bill_number: row.bill_number,
      title: row.title,
      ai_summary: row.ai_summary || row.summary || "",
      external_url: row.external_url || null,
      text_url: row.text_url || null,
      confidence: row.confidence,
    }));

    return new Response(
      JSON.stringify({
        ...topicRow,
        description: topicRow?.description || topicRow?.summary || "",
        civic_items: civicItems,
        bill_count: civicItems.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error fetching hot topic detail:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
