// worker/src/lib/openStatesSync.mjs
// Sync Wyoming bills from OpenStates into civic_items (dev-only helper).

const OS_URL = "https://v3.openstates.org/bills";

import { normalizeBillNumberWy } from "./wyLsoClient.mjs";

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

const normalizeChamber = (org, identifier) => {
  // PRIMARY: Use bill identifier for chamber detection (most reliable for Wyoming)
  // Wyoming uses: HB = House, SF = Senate
  if (identifier) {
    const prefix = (identifier.split(/[\s_-]/)[0] || '').toUpperCase();
    if (prefix === 'HB') return 'house';
    if (prefix === 'SF' || prefix === 'S') return 'senate';
  }
  
  // FALLBACK: Try organization data
  let orgStr = "";
  if (typeof org === "string") {
    orgStr = org;
  } else if (org?.name) {
    orgStr = org.name;
  } else if (org?.classification) {
    // Check classification directly
    if (org.classification === 'upper' || org.classification === 'senate') return 'senate';
    if (org.classification === 'lower' || org.classification === 'house') return 'house';
  }
  
  const o = (orgStr || "").toLowerCase();
  if (o.includes("upper") || o.includes("senate")) return "senate";
  if (o.includes("lower") || o.includes("house") || o.includes("representative")) return "house";
  
  return null;
};

const cleanSponsorName = (name = "") =>
  String(name)
    .replace(/^(rep\.?|sen\.?|representative|senator)\s+/i, "")
    .trim();

const earliestActionDate = (actions = []) =>
  actions.reduce((acc, a) => (!acc || a.date < acc ? a.date : acc), null);
const latestAction = (actions = []) =>
  actions.reduce((acc, a) => (!acc || a.date > acc.date ? a : acc), null);

// Detail endpoint is sparse but includes sponsorships; used to backfill bill_sponsors.
async function getDetailedBillInfo(env, billId) {
  const detailUrl = `${OS_URL}/${billId}?include=sponsorships`;
  const res = await fetch(detailUrl, {
    headers: { "X-API-KEY": env.OPENSTATES_API_KEY },
  });
  if (!res.ok) {
    throw new Error(`OpenStates detail ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data?.results?.[0] || data?.data || data || null;
}

const normalizeSponsorRole = (sponsor = {}) => {
  const cls = Array.isArray(sponsor.classification)
    ? sponsor.classification.join(" ").toLowerCase()
    : (sponsor.classification || "").toLowerCase();
  if (sponsor.primary === true) return "primary";
  if (cls.includes("primary")) return "primary";
  if (cls.includes("co")) return "cosponsor";
  if (cls.includes("committee")) return "committee";
  return cls || "sponsor";
};

export async function upsertBillSponsors(db, civicItemId, detailedBill = {}) {
  const sponsorships = Array.isArray(detailedBill.sponsorships)
    ? detailedBill.sponsorships
    : [];

  const now = new Date().toISOString();
  await db
    .prepare("DELETE FROM bill_sponsors WHERE civic_item_id = ?")
    .bind(civicItemId)
    .run();

  if (!sponsorships.length) {
    console.warn(
      `[SPONSORS] No sponsorships returned for bill ${civicItemId}; cleared existing rows`
    );
    return { inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;
  for (const sponsor of sponsorships) {
    const entityType = (sponsor.entity_type || sponsor.entityType || "").toLowerCase();
    if (entityType && entityType !== "person") {
      skipped++;
      continue;
    }
    const name = cleanSponsorName(sponsor.name || sponsor.person?.name || "");
    if (!name) {
      skipped++;
      continue;
    }

    const openstatesPersonId =
      sponsor.person_id || sponsor.personId || sponsor.person?.id || null;

    try {
      await db
        .prepare(
          `INSERT INTO bill_sponsors (
            civic_item_id, sponsor_name, sponsor_role, sponsor_district,
            chamber, contact_email, contact_phone, contact_website,
            created_at, updated_at, openstates_person_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          civicItemId,
          name,
          normalizeSponsorRole(sponsor),
          sponsor?.person?.current_role?.district || sponsor?.district || null,
          sponsor?.person?.current_role?.chamber || null,
          null,
          null,
          null,
          now,
          now,
          openstatesPersonId
        )
        .run();
      inserted++;
    } catch (err) {
      skipped++;
      console.warn(
        `[SPONSORS] Failed to insert sponsor for ${civicItemId}: ${err.message}`
      );
    }
  }

  console.log(
    `[SPONSORS] Stored ${inserted} sponsor(s) for bill ${civicItemId} (skipped ${skipped})`
  );
  return { inserted, skipped };
}

export async function syncWyomingBills(env, db, { session, limit = 20 } = {}) {
  if (!env.OPENSTATES_API_KEY) throw new Error("Missing OPENSTATES_API_KEY");
  if (!session) throw new Error("session is required");

  console.log(`[SYNC] Starting OpenStates sync for Wyoming, session=${session}, limit=${limit}`);

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
  console.log(`[SYNC] OpenStates returned ${bills.length} bills`);

  let synced = 0;
  let skipped = 0;
  let errors = 0;
  const sample = [];
  const skippedBills = [];
  const billDetails = [];

  for (const bill of bills) {
    // ===== JURISDICTION VALIDATION =====
    const billJurisdiction = bill?.jurisdiction?.name || bill?.jurisdiction || "UNKNOWN";
    if (billJurisdiction.toLowerCase() !== "wyoming") {
      console.warn(`[SKIP] Bill ${bill.identifier} is from "${billJurisdiction}", not Wyoming`);
      skipped++;
      skippedBills.push({
        identifier: bill.identifier,
        title: bill.title,
        jurisdiction: billJurisdiction,
        reason: "Non-Wyoming jurisdiction"
      });
      continue;
    }
    const abstract = bill?.abstracts?.[0]?.abstract || null;
    const subjects = bill?.subjects ? JSON.stringify(bill.subjects) : null;
    const actions = bill?.actions || [];
    const chamber = normalizeChamber(bill.from_organization, bill.identifier);

    const earliest = earliestActionDate(actions);
    const latest = latestAction(actions);
    const now = new Date().toISOString();
    const status = statusFromActions(actions);

    // Log bill details for inspection
    console.log(`[BILL] ${bill.identifier || "NO_ID"} | ${bill.title} | Chamber: ${chamber || "UNKNOWN"} | Status: ${status}`);
    billDetails.push({
      identifier: bill.identifier,
      title: bill.title,
      chamber,
      status,
      jurisdiction: billJurisdiction,
      session: bill.legislative_session,
      subjects: bill.subjects || [],
      actions_count: actions.length,
      first_action: earliest,
      last_action: latest?.date || null,
      has_abstract: !!abstract,
      from_organization: bill.from_organization,
      sources_count: bill.sources?.length || 0,
      versions_count: bill.versions?.length || 0
    });

    const normalizedBillNumber = normalizeBillNumberWy(bill.identifier || "");

    // Require an existing LSO-seeded civic_item (matched by bill_number) to avoid
    // creating Wyoming bills from OpenStates alone.
    const existing = (
      await db
        .prepare(
          "SELECT id, up_votes, down_votes, created_at, title, summary, status, source FROM civic_items WHERE bill_number = ? LIMIT 1"
        )
        .bind(normalizedBillNumber)
        .all()
    ).results?.[0];

    if (!existing) {
      console.warn(
        `[SKIP] OpenStates ${bill.identifier} has no matching LSO civic_item (bill_number=${normalizedBillNumber})`
      );
      skipped++;
      skippedBills.push({
        identifier: bill.identifier,
        title: bill.title,
        jurisdiction: billJurisdiction,
        reason: "No matching LSO bill"
      });
      continue;
    }

    const upVotes = existing?.up_votes ?? 0;
    const downVotes = existing?.down_votes ?? 0;
    const createdAt = existing?.created_at ?? now;
    let saved = false;

    try {
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
            title = COALESCE(civic_items.title, excluded.title),
            summary = COALESCE(civic_items.summary, excluded.summary),
            status = excluded.status,
            legislative_session = excluded.legislative_session,
            chamber = excluded.chamber,
            external_url = COALESCE(civic_items.external_url, excluded.external_url),
            text_url = COALESCE(civic_items.text_url, excluded.text_url),
            category = COALESCE(civic_items.category, excluded.category),
            subject_tags = COALESCE(civic_items.subject_tags, excluded.subject_tags),
            introduced_at = COALESCE(civic_items.introduced_at, excluded.introduced_at),
            last_action = excluded.last_action,
            last_action_date = excluded.last_action_date,
            updated_at = excluded.updated_at`
        )
        .bind(
          existing.id, // keep LSO id
          "bill",
          existing.source || "open_states",
          "statewide",
          "WY",
          normalizedBillNumber,
          existing.title || bill.title || "(untitled)",
          existing.summary || abstract,
          status,
          bill.legislative_session || session,
          chamber,
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

      saved = true;
      synced++;
      console.log(`✅ SYNCED ${synced}: ${bill.identifier}`);
      if (sample.length < 3) {
        sample.push({
          id: bill.id,
          bill_number: bill.identifier,
          title: bill.title,
          status,
          last_action_date: latest?.date || null,
        });
      }
    } catch (err) {
      errors++;
      console.error(`❌ ERROR syncing ${bill.identifier}: ${err.message}`);
    }

    if (!saved) {
      // Skip sponsor fetch if base record could not be saved.
      continue;
    }

    try {
      // WY-only detailed fetch to backfill sponsor list; list endpoint omits it.
      const detailed = await getDetailedBillInfo(env, bill.id);
      await upsertBillSponsors(db, bill.id, detailed);
    } catch (err) {
      console.warn(
        `[SPONSORS] Unable to sync sponsors for ${bill.identifier}: ${err.message}`
      );
    }
  }

  console.log(`\n[SYNC COMPLETE]`);
  console.log(`  ✅ Synced: ${synced}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);

  return { 
    synced, 
    sample, 
    session, 
    count: bills.length,
    skipped,
    errors,
    billDetails,
    skippedBills
  };
}
