// worker/src/lib/civicReviewPipeline.mjs
// Centralized civic item review pipeline:
// 1) structural checks on stored bill metadata (LSO-first, OpenStates secondary)
// 2) optional enrichment (AI summary + hot topic tagging) when structurally sound
// 3) writes results to civic_item_verification with check_type='review_pipeline'

import {
  analyzeBillForHotTopics,
  saveHotTopicAnalysis,
} from "./hotTopicsAnalyzer.mjs";
import { ensureBillSummary } from "./billSummaryAnalyzer.mjs";

const ALLOWED_SOURCES = new Set(["lso", "open_states"]);

// Map structural codes to short human-readable reasons for UI
const STATUS_REASON_MAP = {
  wrong_source: "Unsupported source (only LSO/OpenStates allowed)",
  wrong_jurisdiction: "Outside Wyoming jurisdiction",
  missing_bill_number: "Missing bill number",
  missing_session: "Missing legislative session",
  missing_chamber: "Missing chamber",
  missing_title: "Missing title",
  missing_summary_or_text: "Missing summary or official text link",
  no_wyoming_sponsor: "No Wyoming sponsor on record",
};

export function evaluateStructuralCompleteness(bill, sponsorCount = 0) {
  const reasons = [];

  if (!bill) {
    return {
      structural_ok: false,
      structural_reason: "not_found",
      status_reason: "Bill not found",
      has_summary: false,
      has_wyoming_sponsor: false,
      is_wyoming: false,
    };
  }

  if (!ALLOWED_SOURCES.has((bill.source || "").toLowerCase())) {
    reasons.push("wrong_source");
  }

  const isWyoming = (bill.jurisdiction_key || bill.jurisdiction) === "WY";
  if (!isWyoming) reasons.push("wrong_jurisdiction");

  if (!bill.bill_number) reasons.push("missing_bill_number");
  if (!bill.legislative_session) reasons.push("missing_session");
  if (!bill.chamber) reasons.push("missing_chamber");
  if (!bill.title) reasons.push("missing_title");

  const hasSummary =
    Boolean(bill.summary && bill.summary.trim()) ||
    Boolean(bill.ai_summary && String(bill.ai_summary).trim());
  const hasTextUrl = Boolean(bill.text_url && bill.text_url.trim());
  if (!hasSummary && !hasTextUrl) {
    reasons.push("missing_summary_or_text");
  }

  const hasWySponsor = sponsorCount > 0;
  if (!hasWySponsor) reasons.push("no_wyoming_sponsor");

  const structural_ok = reasons.length === 0;
  const structural_reason = structural_ok ? null : reasons[0];
  const status_reason =
    structural_reason && STATUS_REASON_MAP[structural_reason]
      ? STATUS_REASON_MAP[structural_reason]
      : structural_reason;

  return {
    structural_ok,
    structural_reason,
    status_reason,
    has_summary: hasSummary || hasTextUrl,
    has_wyoming_sponsor: hasWySponsor,
    is_wyoming: isWyoming,
  };
}

async function loadBill(env, billId) {
  const { results = [] } = await env.WY_DB.prepare(
    `SELECT id, bill_number, title, summary, ai_summary, ai_key_points,
            ai_summary_generated_at, text_url, status, legislative_session,
            chamber, source, jurisdiction_key, external_url
       FROM civic_items
      WHERE id = ?`
  )
    .bind(billId)
    .all();
  return results[0] || null;
}

async function loadSponsorCount(env, billId) {
  const { results = [] } = await env.WY_DB.prepare(
    `SELECT COUNT(*) AS sponsor_count FROM bill_sponsors WHERE civic_item_id = ?`
  )
    .bind(billId)
    .all();
  return results[0]?.sponsor_count || 0;
}

async function saveVerification(env, billId, check) {
  const createdAt = new Date().toISOString();
  const bindCommon = [
    billId,
    JSON.stringify(check.issues || []),
    check.verification_status,
    createdAt,
    check.is_wyoming ? 1 : 0,
    check.has_summary ? 1 : 0,
    check.has_wyoming_sponsor ? 1 : 0,
    check.structural_ok ? 1 : 0,
    check.structural_reason || null,
  ];

  try {
    await env.WY_DB.prepare(
      `INSERT INTO civic_item_verification (
         civic_item_id, check_type, topic_match, summary_safe, issues, model, confidence,
         status, created_at, is_wyoming, has_summary, has_wyoming_sponsor,
         structural_ok, structural_reason, status_reason
       ) VALUES (?, 'review_pipeline', 1, 1, ?, 'pipeline', NULL,
         ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(civic_item_id, check_type) DO UPDATE SET
         status = excluded.status,
         created_at = excluded.created_at,
         is_wyoming = excluded.is_wyoming,
         has_summary = excluded.has_summary,
         has_wyoming_sponsor = excluded.has_wyoming_sponsor,
         structural_ok = excluded.structural_ok,
         structural_reason = excluded.structural_reason,
         status_reason = excluded.status_reason,
         issues = excluded.issues`
    )
      .bind(...bindCommon, check.status_reason || null)
      .run();
  } catch (err) {
    // Fallback for schemas missing status_reason column
    console.warn("⚠️ status_reason column missing; saving without it.", err.message);
    await env.WY_DB.prepare(
      `INSERT INTO civic_item_verification (
         civic_item_id, check_type, topic_match, summary_safe, issues, model, confidence,
         status, created_at, is_wyoming, has_summary, has_wyoming_sponsor,
         structural_ok, structural_reason
       ) VALUES (?, 'review_pipeline', 1, 1, ?, 'pipeline', NULL,
         ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(civic_item_id, check_type) DO UPDATE SET
         status = excluded.status,
         created_at = excluded.created_at,
         is_wyoming = excluded.is_wyoming,
         has_summary = excluded.has_summary,
         has_wyoming_sponsor = excluded.has_wyoming_sponsor,
         structural_ok = excluded.structural_ok,
         structural_reason = excluded.structural_reason,
         issues = excluded.issues`
    )
      .bind(...bindCommon)
      .run();
  }

  return { createdAt };
}

function buildIssues(structural_reason) {
  if (!structural_reason) return [];
  return [structural_reason];
}

export async function reviewCivicItem(env, billId) {
  const bill = await loadBill(env, billId);
  const sponsorCount = await loadSponsorCount(env, billId);

  const structural = evaluateStructuralCompleteness(bill, sponsorCount);

  // Optional enrichment: only when structurally sound and missing AI fields
  if (bill && structural.structural_ok) {
    if (!bill.ai_summary || !bill.ai_summary_generated_at) {
      try {
        await ensureBillSummary(env, bill);
      } catch (err) {
        console.warn(`⚠️ ensureBillSummary failed for ${billId}:`, err.message);
      }
    }
    try {
      const analysis = await analyzeBillForHotTopics(env, bill);
      await saveHotTopicAnalysis(env, bill.id, analysis);
    } catch (err) {
      console.warn(`⚠️ hot topic analysis failed for ${billId}:`, err.message);
    }
  }

  const verification_status = structural.structural_ok ? "ok" : "flagged";
  const status_reason = structural.status_reason;
  const issues = buildIssues(structural.structural_reason);

  await saveVerification(env, billId, {
    ...structural,
    verification_status,
    status_reason,
    issues,
  });

  return {
    civic_item_id: billId,
    verification_status,
    status_reason,
    structural_ok: structural.structural_ok,
    structural_reason: structural.structural_reason,
    has_summary: structural.has_summary,
    has_wyoming_sponsor: structural.has_wyoming_sponsor,
    is_wyoming: structural.is_wyoming,
  };
}

export async function reviewAllPendingCivicItems(env) {
  const { results = [] } = await env.WY_DB.prepare(
    `SELECT id FROM civic_items WHERE kind='bill' AND level='statewide' AND jurisdiction_key='WY'`
  ).all();

  const output = [];
  for (const row of results) {
    try {
      const result = await reviewCivicItem(env, row.id);
      output.push(result);
    } catch (err) {
      console.error(`❌ reviewCivicItem failed for ${row.id}:`, err);
      output.push({ civic_item_id: row.id, error: err.message });
    }
  }
  return output;
}
