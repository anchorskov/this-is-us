// worker/src/routes/hotTopics.mjs
// Hot topics endpoints for trending/featured civic issues

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
    const { results = [] } = await env.EVENTS_DB.prepare(
      `SELECT ht.id, ht.slug, ht.title, ht.summary, ht.badge, ht.image_url, ht.cta_label, ht.cta_url,
              ht.priority, ht.is_active, ht.created_at, ht.updated_at, htci.civic_item_id
         FROM hot_topics ht
         LEFT JOIN hot_topic_civic_items htci ON htci.topic_id = ht.id
        WHERE ht.is_active = 1
        ORDER BY ht.priority ASC, ht.created_at DESC`
    ).all();

    const topics = [];
    const topicById = new Map();
    const civicIds = new Set();

    for (const row of results) {
      let topic = topicById.get(row.id);
      if (!topic) {
        topic = {
          id: row.id,
          slug: row.slug,
          title: row.title,
          summary: row.summary,
          badge: row.badge,
          image_url: row.image_url,
          cta_label: row.cta_label,
          cta_url: row.cta_url,
          priority: row.priority,
          is_active: row.is_active,
          created_at: row.created_at,
          updated_at: row.updated_at,
          civic_items: [],
        };
        topicById.set(row.id, topic);
        topics.push(topic);
      }
      if (row.civic_item_id != null) civicIds.add(row.civic_item_id);
    }

    const civicById = await fetchCivicItems(env, [...civicIds]);

    for (const row of results) {
      if (row.civic_item_id != null) {
        const topic = topicById.get(row.id);
        const civic = civicById[row.civic_item_id];
        if (civic) topic.civic_items.push(civic);
      }
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
    const topicRow = await env.EVENTS_DB.prepare(
      `SELECT id, slug, title, summary, badge, image_url, cta_label, cta_url, priority, is_active, created_at, updated_at
         FROM hot_topics 
        WHERE slug = ? AND is_active = 1`
    )
      .bind(slug)
      .first();

    if (!topicRow) {
      return new Response(JSON.stringify({ error: "Topic not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { results = [] } = await env.EVENTS_DB.prepare(
      `SELECT civic_item_id
         FROM hot_topic_civic_items
        WHERE topic_id = ?`
    )
      .bind(topicRow.id)
      .all();

    const civicIds = [
      ...new Set(
        results
          .map((r) => r.civic_item_id)
          .filter((id) => id != null)
      ),
    ];

    const civicById = await fetchCivicItems(env, civicIds);

    const civicItems = civicIds
      .map((id) => civicById[id])
      .filter(Boolean);

    return new Response(
      JSON.stringify({
        ...topicRow,
        civic_items: civicItems,
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
