// worker/src/routes/openStatesSearch.mjs
import { withCORS } from "../utils/cors.js";
import { summarizeCivicItem } from "../lib/civicSummaries.mjs";

const OS_ENDPOINT = "https://v3.openstates.org/bills";

function buildStatus(actions = []) {
  if (!actions.length) return "unknown";
  const latest = actions[actions.length - 1];
  const desc = latest?.description || "";
  if (/failed|veto/i.test(desc)) return "failed";
  if (/passed|approved/i.test(desc)) return "passed";
  if (/introduced/i.test(desc)) return "introduced";
  return desc || "in_progress";
}

function mapBillToItem(bill) {
  const abstract = bill?.abstracts?.[0]?.abstract || null;
  const subjectTags = bill?.subjects ? JSON.stringify(bill.subjects) : null;
  const latestAction = bill?.actions?.length
    ? bill.actions[bill.actions.length - 1]
    : null;
  const status = buildStatus(bill?.actions);

  return {
    id: bill.id,
    external_ref_id: bill.id,
    kind: "bill",
    source: "open_states",
    level: "statewide",
    jurisdiction_key: "WY",
    bill_number: bill.identifier || null,
    title: bill.title || "(untitled)",
    summary: abstract,
    status,
    legislative_session: bill.legislative_session || null,
    chamber: bill.from_organization || null,
    ballot_type: null,
    measure_code: null,
    election_date: null,
    external_url: bill?.sources?.[0]?.url || bill?.openstates_url || null,
    text_url:
      bill?.versions?.[0]?.url ||
      bill?.openstates_url ||
      bill?.sources?.[0]?.url ||
      null,
    category: bill?.classification?.[0] || null,
    subject_tags: subjectTags,
    location_label: "Wyoming",
    introduced_at: bill?.first_action_date || null,
    last_action: latestAction?.description || null,
    last_action_date: latestAction?.date || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    summary_status: "missing",
  };
}

async function fetchOpenStates(env, query, jurisdiction = "wyoming") {
  if (!env.OPENSTATES_API_KEY) {
    throw new Error("Missing OPENSTATES_API_KEY");
  }

  const params = new URLSearchParams({
    q: query,
    jurisdiction,
    sort: "updated_desc",
    per_page: "10",
  });

  const res = await fetch(`${OS_ENDPOINT}?${params.toString()}`, {
    headers: { "X-API-KEY": env.OPENSTATES_API_KEY },
  });
  if (!res.ok) {
    throw new Error(`OpenStates failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function upsertCivicItem(env, item) {
  const sql = `
    INSERT INTO civic_items (
      id, kind, source, level, jurisdiction_key, bill_number, title, summary,
      status, legislative_session, chamber, ballot_type, measure_code,
      election_date, external_ref_id, external_url, text_url, category,
      subject_tags, location_label, introduced_at, last_action,
      last_action_date, created_at, updated_at, summary_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      kind=excluded.kind,
      source=excluded.source,
      level=excluded.level,
      jurisdiction_key=excluded.jurisdiction_key,
      bill_number=excluded.bill_number,
      title=excluded.title,
      summary=excluded.summary,
      status=excluded.status,
      legislative_session=excluded.legislative_session,
      chamber=excluded.chamber,
      external_ref_id=excluded.external_ref_id,
      external_url=excluded.external_url,
      text_url=excluded.text_url,
      category=excluded.category,
      subject_tags=excluded.subject_tags,
      location_label=excluded.location_label,
      introduced_at=excluded.introduced_at,
      last_action=excluded.last_action,
      last_action_date=excluded.last_action_date,
      updated_at=excluded.updated_at,
      summary_status=excluded.summary_status
  `;

  const vals = [
    item.id,
    item.kind,
    item.source,
    item.level,
    item.jurisdiction_key,
    item.bill_number,
    item.title,
    item.summary,
    item.status,
    item.legislative_session,
    item.chamber,
    item.ballot_type,
    item.measure_code,
    item.election_date,
    item.external_ref_id,
    item.external_url,
    item.text_url,
    item.category,
    item.subject_tags,
    item.location_label,
    item.introduced_at,
    item.last_action,
    item.last_action_date,
    item.created_at,
    item.updated_at,
    item.summary_status || "missing",
  ];

  await env.WY_DB.prepare(sql).bind(...vals).run();
}

export async function handleOpenStatesSearch(request, env) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("query") || url.searchParams.get("q");
    const jurisdiction = url.searchParams.get("jurisdiction") || "wyoming";

    if (!q || q.trim().length < 2) {
      return withCORS(
        JSON.stringify({ error: "query parameter required" }),
        400,
        { "Content-Type": "application/json" },
        request
      );
    }

    const data = await fetchOpenStates(env, q.trim(), jurisdiction);
    const bills = data?.results || data?.data || [];

    const rows = [];
    for (const bill of bills) {
      const item = mapBillToItem(bill);
      await upsertCivicItem(env, item);
      rows.push(item);
    }

    return withCORS(JSON.stringify({ results: rows }), 200, {
      "Content-Type": "application/json",
    });
  } catch (err) {
    console.error("❌ handleOpenStatesSearch error:", err);
    return withCORS(
      JSON.stringify({ error: "OpenStates search failed", message: err.message }),
      500,
      { "Content-Type": "application/json" },
      request
    );
  }
}
