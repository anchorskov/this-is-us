// worker/src/routes/pendingBills.mjs
import { withCORS } from "../utils/cors.js";
import { buildUserPromptTemplate } from "../lib/hotTopicsAnalyzer.mjs";

const PENDING_STATUSES = ["introduced", "in_committee", "pending_vote"];
const TOPIC_CONFIDENCE_THRESHOLD = 0.5;

export async function handlePendingBills(request, env) {
  try {
    const url = new URL(request.url);
    const session = url.searchParams.get("session");

    let sql = `
      SELECT id, bill_number, title, summary, status, legislative_session,
             chamber, category, last_action, last_action_date, external_url
        FROM civic_items
       WHERE kind = 'bill'
         AND level = 'statewide'
         AND jurisdiction_key = 'WY'
         AND status IN ('introduced','in_committee','pending_vote')
    `;
    const params = [];
    if (session) {
      sql += " AND legislative_session = ?";
      params.push(session);
    }
    sql += " ORDER BY last_action_date DESC, bill_number";

    const { results } = await env.WY_DB.prepare(sql).bind(...params).all();
    return withCORS(JSON.stringify({ results }), 200, {
      "Content-Type": "application/json",
    });
  } catch (err) {
    console.error("❌ handlePendingBills error:", err);
    return withCORS(
      JSON.stringify({ error: "Internal server error" }),
      500,
      { "Content-Type": "application/json" },
      request
    );
  }
}

function parseSubjectTags(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch (_) {
    // not JSON, fall through
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function handlePendingBillsWithTopics(request, env) {
  try {
    const url = new URL(request.url);
    const topicSlugParam = (url.searchParams.get("topic_slug") || "").trim();
    const topicFilter =
      topicSlugParam && topicSlugParam !== "all" ? topicSlugParam : null;
    const session = url.searchParams.get("session") || null;
    const chamberParam = (url.searchParams.get("chamber") || "").toLowerCase();
    const chamber =
      chamberParam && ["house", "senate"].includes(chamberParam)
        ? chamberParam
        : null;
    const statusParam = (url.searchParams.get("status") || "").toLowerCase();
    const status =
      statusParam && PENDING_STATUSES.includes(statusParam)
        ? statusParam
        : null;

    const statusPlaceholders = PENDING_STATUSES.map(() => "?").join(",");
    let sql = `
      SELECT ci.id,
             ci.bill_number,
             ci.title,
             ci.chamber,
             ci.status,
             ci.legislative_session,
             ci.subject_tags,
             tags.topic_slug,
             tags.confidence,
             tags.trigger_snippet,
             tags.reason_summary
        FROM civic_items ci
        LEFT JOIN civic_item_ai_tags tags
          ON tags.item_id = ci.id
         AND tags.confidence >= ?
       WHERE ci.kind = 'bill'
         AND ci.level = 'statewide'
         AND ci.jurisdiction_key = 'WY'
         AND ci.status IN (${statusPlaceholders})
    `;

    const params = [TOPIC_CONFIDENCE_THRESHOLD, ...PENDING_STATUSES];

    if (session) {
      sql += " AND ci.legislative_session = ?";
      params.push(session);
    }
    if (chamber) {
      sql += " AND ci.chamber = ?";
      params.push(chamber);
    }
    if (status) {
      sql += " AND ci.status = ?";
      params.push(status);
    }
    if (topicFilter) {
      sql += `
        AND EXISTS (
          SELECT 1 FROM civic_item_ai_tags t
           WHERE t.item_id = ci.id
             AND t.topic_slug = ?
             AND t.confidence >= ?
        )
      `;
      params.push(topicFilter, TOPIC_CONFIDENCE_THRESHOLD);
    }

    sql += " ORDER BY ci.legislative_session DESC, ci.bill_number ASC LIMIT 100";

    const { results = [] } = await env.WY_DB.prepare(sql).bind(...params).all();

    // Fetch topic metadata from EVENTS_DB and map by slug
    const { results: topicRows = [] } = await env.EVENTS_DB.prepare(
      `SELECT slug, title, badge, priority
         FROM hot_topics
        WHERE is_active = 1`
    ).all();
    const topicMeta = new Map(
      topicRows.map((row) => [
        row.slug,
        {
          slug: row.slug,
          label: row.title,
          badge: row.badge,
          priority: row.priority,
        },
      ])
    );

    const bills = new Map();
    const topicSeen = new Map();

    for (const row of results) {
      let bill = bills.get(row.id);
      if (!bill) {
        bill = {
          id: row.id,
          bill_number: row.bill_number,
          title: row.title,
          chamber: row.chamber,
          status: row.status,
          legislative_session: row.legislative_session,
          subject_tags: parseSubjectTags(row.subject_tags),
          topics: [],
        };
        bills.set(row.id, bill);
        topicSeen.set(row.id, new Set());
      }

      if (row.topic_slug) {
        if (topicFilter && row.topic_slug !== topicFilter) continue;
        const meta = topicMeta.get(row.topic_slug) || {
          slug: row.topic_slug,
          label: row.topic_slug,
          badge: "",
          priority: null,
        };
        const confidence =
          typeof row.confidence === "number"
            ? row.confidence
            : row.confidence
            ? parseFloat(row.confidence)
            : null;

        const seen = topicSeen.get(row.id);
        if (seen.has(row.topic_slug)) continue;
        seen.add(row.topic_slug);

        bill.topics.push({
          slug: row.topic_slug,
          label: meta.label,
          badge: meta.badge,
          priority: meta.priority,
          confidence,
          reason_summary: row.reason_summary || "",
          trigger_snippet: row.trigger_snippet || "",
          user_prompt_template: buildUserPromptTemplate(
            row.bill_number,
            meta.label
          ),
        });
      }
    }

    return withCORS(
      JSON.stringify({ results: Array.from(bills.values()) }),
      200,
      {
        "Content-Type": "application/json",
      }
    );
  } catch (err) {
    console.error("❌ handlePendingBillsWithTopics error:", err);
    return withCORS(
      JSON.stringify({ error: "Internal server error" }),
      500,
      { "Content-Type": "application/json" },
      request
    );
  }
}
