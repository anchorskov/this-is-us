// worker/src/lib/openStatesSync.mjs
// Sync Wyoming bills from OpenStates into civic_items (dev-only helper).

const OS_URL = "https://v3.openstates.org/bills";

const statusFromActions = (actions = []) => {
  if (!actions.length) return "introduced";
  const has = (cls) => actions.some((a) => (a.classification || []).includes(cls));
  if (has("withdrawal") || has("failure")) return "failed";
  // crude final passage check
  const chamberPassages = actions.filter((a) => (a.classification || []).includes("passage"));
  const chambers = new Set(chamberPassages.map((a) => a.organization || a.from_organization));
  if (chambers.size >= 2) return "passed";
  if (has("passage")) return "pending_vote";
  if (has("committee")) return "in_committee";
  return "introduced";
};

const normalizeChamber = (org) => {
  // Handle both string and object inputs (org might be object with name property)
  let orgStr = "";
  if (typeof org === "string") {
    orgStr = org;
  } else if (org && typeof org === "object" && org.name) {
    orgStr = org.name;
  } else if (org && typeof org === "object") {
    orgStr = String(org);
  }
  
  const o = (orgStr || "").toLowerCase();
  if (o.includes("upper")) return "senate";
  if (o.includes("lower")) return "house";
  if (o.includes("senate")) return "senate";
  if (o.includes("house")) return "house";
  return null;
};

const earliestActionDate = (actions = []) =>
  actions.reduce((acc, a) => (!acc || a.date < acc ? a.date : acc), null);
const latestAction = (actions = []) =>
  actions.reduce((acc, a) => (!acc || a.date > acc.date ? a : acc), null);

export async function syncWyomingBills(env, db, { session, limit = 20 } = {}) {
  if (!env.OPENSTATES_API_KEY) throw new Error("Missing OPENSTATES_API_KEY");
  if (!session) throw new Error("session is required");

  const params = new URLSearchParams({
    jurisdiction: "Wyoming",
    session,
    per_page: String(limit),
    sort: "updated_desc",
  });

  const res = await fetch(`${OS_URL}?${params.toString()}`, {
    headers: { "X-API-KEY": env.OPENSTATES_API_KEY },
  });
  if (!res.ok) throw new Error(`OpenStates error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const bills = data?.results || data?.data || [];

  let synced = 0;
  const sample = [];

  for (const bill of bills) {
    const abstract = bill?.abstracts?.[0]?.abstract || null;
    const subjects = bill?.subjects ? JSON.stringify(bill.subjects) : null;
    const actions = bill?.actions || [];

    const earliest = earliestActionDate(actions);
    const latest = latestAction(actions);
    const now = new Date().toISOString();
    const status = statusFromActions(actions);

    // pull existing to keep votes/created_at
    const existing = (
      await db
        .prepare(
          "SELECT up_votes, down_votes, created_at FROM civic_items WHERE id = ?"
        )
        .bind(bill.id)
        .all()
    ).results?.[0];

    const upVotes = existing?.up_votes ?? 0;
    const downVotes = existing?.down_votes ?? 0;
    const createdAt = existing?.created_at ?? now;

    await db
      .prepare(
        `INSERT INTO civic_items (
          id, kind, source, level, jurisdiction_key, bill_number, title, summary,
          status, legislative_session, chamber, ballot_type, measure_code,
          election_date, external_ref_id, external_url, text_url, category,
          subject_tags, location_label, introduced_at, last_action,
          last_action_date, created_at, updated_at, up_votes, down_votes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          bill_number = excluded.bill_number,
          title = excluded.title,
          summary = excluded.summary,
          status = excluded.status,
          legislative_session = excluded.legislative_session,
          chamber = excluded.chamber,
          external_url = excluded.external_url,
          text_url = excluded.text_url,
          category = excluded.category,
          subject_tags = excluded.subject_tags,
          introduced_at = excluded.introduced_at,
          last_action = excluded.last_action,
          last_action_date = excluded.last_action_date,
          updated_at = excluded.updated_at`
      )
      .bind(
        bill.id,
        "bill",
        "open_states",
        "statewide",
        "WY",
        bill.identifier || null,
        bill.title || "(untitled)",
        abstract,
        status,
        bill.legislative_session || session,
        normalizeChamber(bill.from_organization),
        null,
        null,
        null,
        bill.id,
        bill?.sources?.[0]?.url || bill?.openstates_url || null,
        bill?.versions?.[0]?.links?.[0]?.url ||
          bill?.versions?.[0]?.url ||
          bill?.openstates_url ||
          bill?.sources?.[0]?.url ||
          null,
        bill?.subjects?.[0] || null,
        subjects,
        "Wyoming",
        earliest,
        latest?.description || null,
        latest?.date || null,
        createdAt,
        now,
        upVotes,
        downVotes
      )
      .run();

    synced += 1;
    if (sample.length < 3) {
      sample.push({
        id: bill.id,
        bill_number: bill.identifier,
        title: bill.title,
        status,
        last_action_date: latest?.date || null,
      });
    }
  }

  return { synced, sample, session, count: bills.length };
}
