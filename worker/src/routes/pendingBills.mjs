// worker/src/routes/pendingBills.mjs
import { withCORS } from "../utils/cors.js";
import { buildUserPromptTemplate } from "../lib/hotTopicsAnalyzer.mjs";
import { buildAiSummaryNotice } from "../lib/billSummaryAnalyzer.mjs";

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

function parseKeyPoints(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch (_) {
    // not JSON, fall through
  }
  return [];
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
    const includeFlagged =
      (url.searchParams.get("include_flagged") || "").toLowerCase() === "true";
    const includeIncomplete =
      (url.searchParams.get("include_incomplete") || "").toLowerCase() === "true";

    console.log("🔍 handlePendingBillsWithTopics called with filters:", {
      topicFilter,
      session,
      chamber,
      status,
    });

    const statusPlaceholders = PENDING_STATUSES.map(() => "?").join(",");
    let sql = `
      SELECT ci.id,
             ci.bill_number,
             ci.title,
             ci.summary AS short_title,
             ci.chamber,
             ci.status,
             ci.legislative_session,
             ci.subject_tags,
             ci.ai_summary AS ai_plain_summary,
             ci.ai_key_points AS ai_key_points_json,
             ci.text_url,
             ci.external_url,
             ci.ai_summary_generated_at,
             COALESCE(v.up_votes, 0)   AS up_votes,
             COALESCE(v.down_votes, 0) AS down_votes,
             COALESCE(v.info_votes, 0) AS info_votes,
             civ.status AS verification_status,
             civ.structural_ok,
             civ.structural_reason,
             civ.has_wyoming_sponsor,
             civ.is_wyoming,
             civ.has_summary,
             civ.confidence AS verification_confidence,
             civh.review_status,
             civh.has_lso_summary,
             civh.has_lso_text,
             civh.lso_text_source,
             tags.topic_slug,
             tags.confidence,
             tags.trigger_snippet,
             tags.reason_summary,
             bs.sponsor_name,
             bs.sponsor_role,
             bs.sponsor_district,
             bs.contact_email,
             bs.contact_phone,
             bs.contact_website
        FROM civic_items ci
        LEFT JOIN (
          SELECT target_id,
                 SUM(CASE WHEN value = 1 THEN 1 ELSE 0 END)  AS up_votes,
                 SUM(CASE WHEN value = -1 THEN 1 ELSE 0 END) AS down_votes,
                 SUM(CASE WHEN value = 0 THEN 1 ELSE 0 END)  AS info_votes
            FROM votes
           WHERE target_type = 'civic_item'
           GROUP BY target_id
        ) v ON v.target_id = ci.id
        LEFT JOIN civic_item_verification civ
          ON civ.civic_item_id = ci.id
         AND civ.check_type = 'review_pipeline'
         AND civ.created_at = (
              SELECT MAX(created_at)
                FROM civic_item_verification civ2
               WHERE civ2.civic_item_id = ci.id
                 AND civ2.check_type = 'review_pipeline'
             )
        LEFT JOIN civic_item_verification civh
          ON civh.civic_item_id = ci.id
         AND civh.check_type = 'lso_hydration'
         AND civh.created_at = (
              SELECT MAX(created_at)
                FROM civic_item_verification civh2
               WHERE civh2.civic_item_id = ci.id
                 AND civh2.check_type = 'lso_hydration'
             )
        LEFT JOIN civic_item_ai_tags tags
          ON tags.item_id = ci.id
         AND tags.confidence >= ?
        LEFT JOIN bill_sponsors bs
          ON bs.civic_item_id = ci.id
       WHERE ci.kind = 'bill'
         AND ci.level = 'statewide'
         AND ci.jurisdiction_key = 'WY'
         AND ci.source = 'lso'
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

    if (!includeFlagged) {
      sql += " AND civ.structural_ok = 1 AND civ.status = 'ok'";
    }
    if (!includeIncomplete) {
      sql += " AND (civh.review_status = 'ready' OR civh.civic_item_id IS NULL)";
    }

    sql += " ORDER BY ci.legislative_session DESC, ci.bill_number ASC LIMIT 100";

    console.log("📜 SQL query:", sql.substring(0, 200), "...");
    console.log("📌 SQL params:", params);

    const { results = [] } = await env.WY_DB.prepare(sql).bind(...params).all();
    console.log(`📦 Raw query results: ${results.length} rows`);

    // Fetch topic metadata from EVENTS_DB and map by slug
    const { results: topicRows = [] } = await env.EVENTS_DB.prepare(
      `SELECT slug, title, badge, priority
         FROM hot_topics
        WHERE is_active = 1`
    ).all();
    console.log(`📚 Loaded ${topicRows.length} topic metadata rows`);

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
    const sponsorSeen = new Map();

    for (const row of results) {
      let bill = bills.get(row.id);
      if (!bill) {
        bill = {
          id: row.id,
          bill_number: row.bill_number,
          title: row.title,
          short_title: row.short_title || row.title || "",
          chamber: row.chamber,
          status: row.status,
          legislative_session: row.legislative_session,
          external_url: row.external_url || "",
          text_url: row.text_url || "",
          subject_tags: parseSubjectTags(row.subject_tags),
          ai_plain_summary: row.ai_plain_summary || "",
          ai_key_points: parseKeyPoints(row.ai_key_points_json),
          ai_summary_notice: buildAiSummaryNotice(row.ai_summary_generated_at),
          up_votes: row.up_votes ?? 0,
          down_votes: row.down_votes ?? 0,
          info_votes: row.info_votes ?? 0,
          verification_status: row.verification_status || "missing",
          status_reason: row.structural_reason || null,
          review_status: row.review_status || null,
          has_lso_summary:
            row.has_lso_summary === null || row.has_lso_summary === undefined
              ? null
              : row.has_lso_summary === 1 || row.has_lso_summary === true,
          has_lso_text:
            row.has_lso_text === null || row.has_lso_text === undefined
              ? null
              : row.has_lso_text === 1 || row.has_lso_text === true,
          lso_text_source: row.lso_text_source || null,
          verification_confidence:
            typeof row.verification_confidence === "number"
              ? row.verification_confidence
              : row.verification_confidence
              ? parseFloat(row.verification_confidence)
              : null,
          structural_ok:
            row.structural_ok === null || row.structural_ok === undefined
              ? null
              : row.structural_ok === 1 || row.structural_ok === true,
          structural_reason: row.structural_reason || null,
          has_wyoming_sponsor:
            row.has_wyoming_sponsor === null || row.has_wyoming_sponsor === undefined
              ? null
              : row.has_wyoming_sponsor === 1 || row.has_wyoming_sponsor === true,
          is_wyoming:
            row.is_wyoming === null || row.is_wyoming === undefined
              ? null
              : row.is_wyoming === 1 || row.is_wyoming === true,
          has_summary:
            row.has_summary === null || row.has_summary === undefined
              ? null
              : row.has_summary === 1 || row.has_summary === true,
          sponsors: [],
          topics: [],
        };
        bills.set(row.id, bill);
        topicSeen.set(row.id, new Set());
        sponsorSeen.set(row.id, new Set());
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

      if (row.sponsor_name) {
        const sSeen = sponsorSeen.get(row.id);
        const key = `${row.sponsor_name}-${row.sponsor_role || ""}`;
        if (!sSeen.has(key)) {
          sSeen.add(key);
          bill.sponsors.push({
            name: row.sponsor_name,
            role: row.sponsor_role || null,
            district: row.sponsor_district || null,
            contact_email: row.contact_email || null,
            contact_phone: row.contact_phone || null,
            contact_website: row.contact_website || null,
          });
        }
      }
    }

    const billsArray = Array.from(bills.values());
    console.log(
      `✅ Processed into ${billsArray.length} unique bills with topics`
    );
    if (billsArray.length > 0) {
      console.log(
        "🔍 First bill:",
        JSON.stringify(billsArray[0], null, 2).substring(0, 300)
      );
    }

    return withCORS(
      JSON.stringify({ results: billsArray }),
      200,
      {
        "Content-Type": "application/json",
      }
    );
  } catch (err) {
    console.error("❌ handlePendingBillsWithTopics error:", err);
    return withCORS(
      JSON.stringify({ error: "Internal server error", message: err.message }),
      500,
      { "Content-Type": "application/json" },
      request
    );
  }
}
