// worker/src/lib/wyLsoClient.mjs
// Summary (ingestion state as of Dec 2025):
// - Bills currently enter WY_DB via OpenStates sync (dev-only) that inserts civic_items and sponsors.
// - OpenStates sync enforces jurisdiction=Wyoming and now should only enrich existing LSO-matched bills.
// - We do NOT yet ingest from LSO; this client adds an LSO-first path to seed civic_items as source='lso'.
// - LSO endpoints used: GetCommitteeBills/{year} (billNum/shortTitle/sponsor/status/actions), optional bill detail.
// - LSO acts as ground truth (bill number, session, sponsor committee, short title); OpenStates is helper only after match.
// - OpenAI enrichment should run only on grounded/complete records (after LSO insert + structural checks).

import { resolveLsoTextUrl } from "./wyLsoBillText.mjs";

const LSO_BASE = "https://lsoservice.wyoleg.gov/api";

const LSO_COMMITTEE_BILLS = (year) =>
  `${LSO_BASE}/BillInformation/GetCommitteeBills/${year}`;
const LSO_BILL_INFO = (year, billNum, specialSessionValue = "") =>
  `${LSO_BASE}/BillInformation/${year}/${billNum}/${specialSessionValue || ""}`;

const wyUrlForBill = (year, billNum) =>
  `https://wyoleg.gov/Legislation/${year}/${billNum}`;

const normalizeBillNumberWy = (billNum = "") => {
  const match = String(billNum).toUpperCase().match(/^(HB|SF|SB)\s*0*?(\d+)/);
  if (!match) return String(billNum).toUpperCase().trim();
  const num = match[2].padStart(4, "0");
  return `${match[1]}${num}`;
};

const mapLsoStatus = (billStatus) => {
  if (!billStatus) return "draft_committee";
  const s = String(billStatus).toLowerCase();
  if (s.includes("introduc")) return "introduced";
  if (s.includes("committee")) return "in_committee";
  if (s.includes("pass")) return "passed";
  if (s.includes("fail") || s.includes("veto")) return "failed";
  return "draft_committee";
};

export async function fetchCommitteeBills(year) {
  const res = await fetch(LSO_COMMITTEE_BILLS(year));
  if (!res.ok) {
    throw new Error(`LSO committee bills ${year} failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchBillInformation(year, billNum, specialSessionValue = "") {
  const url = LSO_BILL_INFO(year, billNum, specialSessionValue);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`LSO bill info ${billNum} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function chamberFromBillNum(billNum = "") {
  const n = billNum.toUpperCase();
  if (n.startsWith("HB")) return "house";
  if (n.startsWith("SF") || n.startsWith("SB")) return "senate";
  return null;
}

export function buildCivicItemFromLso(bill = {}) {
  const billNumber = normalizeBillNumberWy(bill.billNum);
  const shortTitle = (bill.shortTitle || "").trim();
  const status = mapLsoStatus(bill.billStatus);
  const external_url = bill.billNum ? wyUrlForBill(bill.year, bill.billNum) : null;

  if (!shortTitle) {
    console.warn(`⚠️  LSO bill ${bill.billNum} missing shortTitle; setting short_title="Unavailable"`);
  }

  // Use composite ID format: ${year}_${billNumber} to avoid PRIMARY KEY conflicts
  // This allows the same bill_number to exist in multiple legislative sessions
  const year = String(bill.year || "");
  const compositeId = year && billNumber ? `${year}_${billNumber}` : billNumber;

  return {
    id: compositeId, // Composite ID: "2026_HB0011" prevents cross-session collisions
    kind: "bill",
    source: "lso",
    level: "statewide",
    jurisdiction_key: "WY",
    bill_number: billNumber,
    title: shortTitle || bill.billNum || "(untitled)",
    // summary doubles as the short title for now (schema lacks short_title column)
    summary: shortTitle || null,
    short_title: shortTitle || "Unavailable",
    status,
    legislative_session: year,
    chamber: chamberFromBillNum(bill.billNum),
    external_ref_id: bill.billNum || null,
    external_url,
    text_url: null, // populated later when a PDF is discovered
    category: null,
    subject_tags: null,
    location_label: "Wyoming",
    introduced_at: null,
    last_action: bill.lastAction || null,
    last_action_date: bill.lastActionDate || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function upsertCivicItem(db, item) {
  const now = new Date().toISOString();
  
  // Guard against undefined/null values that D1 won't accept
  const bindValues = [
    item.id || "",
    item.kind || "bill",
    item.source || "lso",
    item.level || "statewide",
    item.jurisdiction_key || "WY",
    item.bill_number || "",
    item.title || "",
    item.summary || null,
    item.status || "draft_committee",
    item.legislative_session || "",
    item.chamber || null,
    null, // ballot_type
    null, // measure_code
    null, // election_date
    item.external_ref_id || null,
    item.external_url || null,
    item.text_url || null,
    item.category || null,
    item.subject_tags || null,
    item.location_label || "Wyoming",
    item.introduced_at || null,
    item.last_action || null,
    item.last_action_date || null,
    item.created_at || now,
    item.updated_at || now,
    now
  ];

  await db
    .prepare(
      `INSERT INTO civic_items (
        id, kind, source, level, jurisdiction_key, bill_number, title, summary,
        status, legislative_session, chamber, ballot_type, measure_code,
        election_date, external_ref_id, external_url, text_url, category,
        subject_tags, location_label, introduced_at, last_action,
        last_action_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source = excluded.source,
        bill_number = excluded.bill_number,
        title = excluded.title,
        summary = COALESCE(civic_items.summary, excluded.summary),
        status = excluded.status,
        legislative_session = excluded.legislative_session,
        chamber = excluded.chamber,
        external_ref_id = excluded.external_ref_id,
        external_url = COALESCE(civic_items.external_url, excluded.external_url),
        text_url = COALESCE(civic_items.text_url, excluded.text_url),
        last_action = excluded.last_action,
        last_action_date = excluded.last_action_date,
        updated_at = ?
      `
    )
    .bind(...bindValues)
    .run();
}

async function upsertCommitteeSponsor(db, civicItemId, sponsorName) {
  if (!sponsorName) return;
  const now = new Date().toISOString();
  await db
    .prepare("DELETE FROM bill_sponsors WHERE civic_item_id = ?")
    .bind(civicItemId)
    .run();
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
      sponsorName,
      "committee_requestor",
      null,
      null,
      null,
      null,
      null,
      now,
      now,
      null
    )
    .run();
}

export async function syncLsoCommitteeBillsToCivicItems(env, year) {
  if (!year) throw new Error("year is required");
  const committees = await fetchCommitteeBills(year);
  let synced = 0;
  let errors = 0;

  // committees is an array of committee objects, each with sponsoredBills array
  for (const committee of committees) {
    const sponsoredBills = committee.sponsoredBills || [];
    
    for (const bill of sponsoredBills) {
      try {
        // Guard against missing billNum
        if (!bill.billNum) {
          console.warn(`⚠️  Skipping bill without billNum in committee ${committee.committeeDetail?.committeeName || 'unknown'}`);
          continue;
        }

        // Ensure year is set on bill object
        if (!bill.year) {
          bill.year = year;
        }

        const civicItem = buildCivicItemFromLso(bill);
        await upsertCivicItem(env.WY_DB, civicItem);
        await upsertCommitteeSponsor(env.WY_DB, civicItem.id, bill.sponsor || null);
        synced++;
      } catch (err) {
        errors++;
        console.error(`❌ LSO sync failed for ${bill.billNum}: ${err.message}`);
      }
    }
  }

  return { synced, errors, count: committees.length, year };
}

function stripHtmlToText(html = "") {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function upsertSponsorsFromLso(db, civicItemId, sponsors = []) {
  await db.prepare("DELETE FROM bill_sponsors WHERE civic_item_id = ?").bind(civicItemId).run();
  if (!Array.isArray(sponsors) || !sponsors.length) return;
  const now = new Date().toISOString();
  for (const sponsor of sponsors) {
    const name = sponsor?.Name || sponsor?.name || sponsor?.SponsorName || sponsor?.sponsorName;
    if (!name) continue;
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
        sponsor?.Role || sponsor?.role || sponsor?.SponsorRole || "primary",
        sponsor?.District || sponsor?.district || null,
        sponsor?.Chamber || sponsor?.chamber || null,
        sponsor?.Email || sponsor?.email || null,
        sponsor?.Phone || sponsor?.phone || null,
        sponsor?.Website || sponsor?.website || null,
        now,
        now,
        null
      )
      .run();
  }
}

async function upsertHydrationVerification(env, civicItemId, data) {
  const {
    has_lso_summary,
    has_lso_text,
    lso_text_source,
    review_status,
    status,
    structural_reason,
  } = data;
  const now = new Date().toISOString();
  await env.WY_DB.prepare(
    `INSERT INTO civic_item_verification (
        civic_item_id, check_type, topic_match, summary_safe, issues,
        model, confidence, status, created_at,
        is_wyoming, has_summary, has_wyoming_sponsor, structural_ok, structural_reason,
        has_lso_summary, has_lso_text, lso_text_source, review_status
      ) VALUES (?, 'lso_hydration', 1, 1, NULL, 'hydration', NULL, ?, ?, 1, ?, NULL, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(civic_item_id, check_type) DO UPDATE SET
        status=excluded.status,
        created_at=excluded.created_at,
        structural_ok=excluded.structural_ok,
        structural_reason=excluded.structural_reason,
        has_lso_summary=excluded.has_lso_summary,
        has_lso_text=excluded.has_lso_text,
        lso_text_source=excluded.lso_text_source,
        review_status=excluded.review_status`
  )
    .bind(
      civicItemId,
      status,
      now,
      has_lso_summary ? 1 : 0,
      data.structural_ok ? 1 : 0,
      structural_reason || null,
      has_lso_summary ? 1 : 0,
      has_lso_text ? 1 : 0,
      lso_text_source || "none",
      review_status || "incomplete"
    )
    .run();
}

export async function hydrateLsoBill(env, year, billNum, specialSessionValue = 0) {
  const billInfo = await fetchBillInformation(year, billNum, specialSessionValue);
  const summaryText = stripHtmlToText(billInfo?.summaryHTML || "");
  const status = mapLsoStatus(billInfo?.BillStatus || billInfo?.billStatus);
  const chamber = chamberFromBillNum(billNum);
  const textMeta = resolveLsoTextUrl(
    billInfo,
    LSO_BILL_INFO(year, billNum, specialSessionValue)
  );
  const hasSummary = !!summaryText;
  const hasText = !!textMeta.textUrl && textMeta.textUrl !== "unavailable";
  const structural_ok = hasSummary && hasText;
  const review_status = structural_ok ? "ready" : "incomplete";

  await env.WY_DB.prepare(
    `UPDATE civic_items
        SET summary = COALESCE(NULLIF(summary, ''), ?),
            introduced_at = COALESCE(?, introduced_at),
            last_action = COALESCE(?, last_action),
            last_action_date = COALESCE(?, last_action_date),
            status = COALESCE(?, status),
            chamber = COALESCE(?, chamber),
            text_url = ?,
            external_url = COALESCE(?, external_url),
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
  )
    .bind(
      summaryText || null,
      billInfo?.IntroDate || billInfo?.IntroductionDate || null,
      billInfo?.LastAction || billInfo?.lastAction || null,
      billInfo?.LastActionDate || billInfo?.lastActionDate || null,
      status,
      chamber,
      textMeta.textUrl || "unavailable",
      wyUrlForBill(year, billNum),
      normalizeBillNumberWy(billNum)
    )
    .run();

  await upsertSponsorsFromLso(env.WY_DB, normalizeBillNumberWy(billNum), billInfo?.Sponsors || []);

  await upsertHydrationVerification(env, normalizeBillNumberWy(billNum), {
    has_lso_summary: hasSummary,
    has_lso_text: hasText,
    lso_text_source: textMeta.source,
    review_status,
    status: structural_ok ? "ok" : "flagged",
    structural_ok,
    structural_reason: structural_ok
      ? null
      : hasSummary
      ? "missing_text"
      : "missing_summary",
  });

  return {
    bill_id: normalizeBillNumberWy(billNum),
    has_summary: hasSummary,
    has_text: hasText,
    review_status,
    text_source: textMeta.source,
    text_url: textMeta.textUrl,
  };
}

export async function hydrateLsoBillsBatch(env, year, limit = 25, specialSessionValue = 0) {
  const { results: rows = [] } = await env.WY_DB.prepare(
    `SELECT id FROM civic_items
      WHERE source='lso' AND legislative_session = ?
      ORDER BY bill_number
      LIMIT ?`
  )
    .bind(String(year), limit)
    .all();

  let hydrated = 0;
  let ready = 0;
  let incomplete = 0;
  let missing_pdf = 0;
  let missing_html = 0;
  for (const row of rows) {
    try {
      const res = await hydrateLsoBill(env, year, row.id, specialSessionValue);
      hydrated++;
      if (res.review_status === "ready") ready++;
      else incomplete++;
      if (res.text_source !== "pdf") missing_pdf++;
      if (res.text_source !== "html" && res.text_source !== "pdf") missing_html++;
    } catch (err) {
      incomplete++;
      console.error(`❌ Hydration failed for ${row.id}: ${err.message}`);
    }
  }

  return { hydrated, ready, incomplete, missing_pdf, missing_html, total: rows.length };
}

export { normalizeBillNumberWy, wyUrlForBill };
