/**
 * worker/src/routes/civicScan.mjs
 * 
 * Dev-only routes for scanning pending Wyoming bills and testing individual bill analysis.
 * 
 * **Routes:**
 * - GET /api/internal/civic/test-one?bill_id=<id>&bill_number=<num>
 *   Load a single pending bill without calling OpenAI (Milestone 1: setup test)
 * 
 * - POST /api/internal/civic/test-one?summaryOnly=true
 *   Call OpenAI on one bill using cost-efficient mode (Milestone 2: token tracking)
 * 
 * - POST /api/internal/civic/scan-pending-bills
 *   Batch scan of up to 5 pending bills (production scan path)
 */

import { 
  analyzeBillForHotTopics, 
  saveHotTopicAnalysis,
  getSinglePendingBill,
  buildUserPromptTemplate,
} from "../lib/hotTopicsAnalyzer.mjs";

import {
  analyzeBillSummary,
  saveBillSummary,
  ensureBillSummary,
  ensureHotTopicForBill,
} from "../lib/billSummaryAnalyzer.mjs";

import { resolveDocument } from "../lib/docResolver/index.mjs";

const PENDING_STATUSES = ["draft_committee", "introduced", "in_committee", "pending_vote"];
const BATCH_SIZE = 5; // Scan 5 bills per request for cost & safety
const MAX_AGE_DAYS = 7; // Re-scan bills older than this if already tagged
const DOC_RESOLVER_DEBUG_FLAG = "DOC_RESOLVER_DEBUG";

async function getCachedSource(env, billId) {
  try {
    return await env.WY_DB.prepare(
      `SELECT civic_item_id, best_doc_url, best_doc_kind, status, checked_at, last_error
         FROM civic_item_sources
        WHERE civic_item_id = ?`
    )
      .bind(billId)
      .first();
  } catch (err) {
    console.warn("⚠️ Failed to read civic_item_sources", billId, err.message);
    return null;
  }
}

async function upsertCivicItemSource(env, billId, resolution, error = null) {
  const best = resolution?.best || null;
  const now = new Date().toISOString();
  try {
    await env.WY_DB.prepare(
      `INSERT OR REPLACE INTO civic_item_sources
         (civic_item_id, best_doc_url, best_doc_kind, status, checked_at, last_error)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    )
      .bind(
        billId,
        best?.url || null,
        best?.kind || null,
        best ? "ok" : "missing",
        now,
        error || null
      )
      .run();
  } catch (err) {
    console.warn("⚠️ Failed to upsert civic_item_sources", billId, err.message);
  }
}

/**
 * selectBillsForScan(env, options)
 *
 * Query WY_DB.civic_items for bills with pending status that need analysis.
 * Prioritizes bills missing AI tags or whose tags are stale.
 */
async function selectBillsForScan(
  env,
  { limit = BATCH_SIZE, force = false, maxAgeDays = MAX_AGE_DAYS, billId = null, year = null, debug = false } = {}
) {
  if (billId) {
    const { results = [] } = await env.WY_DB.prepare(
      `SELECT 
         id, 
         bill_number, 
         title, 
         summary, 
         subject_tags, 
         text_url, 
         status, 
         legislative_session,
         chamber,
         last_action,
         last_action_date,
         ai_summary,
         ai_summary_generated_at,
         0 AS tag_count,
         NULL AS last_tag_at
       FROM civic_items
       WHERE id = ? AND status IN (${PENDING_STATUSES.map(() => "?").join(",")})
         AND inactive_at IS NULL
       LIMIT 1`
    )
      .bind(billId, ...PENDING_STATUSES)
      .all();
    return results;
  }

  const placeholders = PENDING_STATUSES.map(() => "?").join(",");
  const ageClause = `datetime('now', ?)`;
  const yearFilter = year ? `AND ci.legislative_session = ?` : '';
  const sql = `
    SELECT 
      id, 
      bill_number, 
      title, 
      summary, 
      subject_tags, 
      text_url, 
      status, 
      legislative_session,
      chamber,
      last_action,
      last_action_date,
      ai_summary,
      ai_summary_generated_at
      ,tag_stats.tag_count
      ,tag_stats.last_tag_at
    FROM civic_items ci
    LEFT JOIN (
      SELECT item_id, COUNT(*) AS tag_count, MAX(created_at) AS last_tag_at
      FROM civic_item_ai_tags
      GROUP BY item_id
    ) tag_stats ON tag_stats.item_id = ci.id
    WHERE ci.status IN (${placeholders})
      AND ci.level = 'statewide'
      AND ci.jurisdiction_key = 'WY'
      AND ci.source = 'lso'
      AND ci.inactive_at IS NULL
      ${yearFilter}
      AND (
        ? = 1
        OR tag_stats.tag_count IS NULL
        OR tag_stats.last_tag_at < ${ageClause}
      )
    ORDER BY 
      CASE WHEN ai_summary IS NULL OR ai_summary = '' THEN 0 ELSE 1 END,
      last_action_date DESC
    LIMIT ?
  `;
  const bindParams = year 
    ? [...PENDING_STATUSES, year, force ? 1 : 0, `-${maxAgeDays} days`, limit]
    : [...PENDING_STATUSES, force ? 1 : 0, `-${maxAgeDays} days`, limit];
  
  const { results = [] } = await env.WY_DB.prepare(sql)
    .bind(...bindParams)
    .all();
  console.log(`[SCAN] selectBillsForScan: found ${results.length} candidates (year=${year || 'any'}, limit=${limit}, force=${force})`);
  
  // Debug diagnostics if requested
  if (debug) {
    const diagnostics = await getDiagnosticCounts(env, year);
    console.log(`[SCAN_DEBUG] Filter steps:`, JSON.stringify(diagnostics, null, 2));
  }
  
  return results;
}

/**
 * Helper: Get diagnostic counts showing filter steps
 */
async function getDiagnosticCounts(env, year) {
  try {
    const total = await env.WY_DB.prepare(
      `SELECT COUNT(*) as count FROM civic_items`
    ).first();
    
    const byYear = year ? await env.WY_DB.prepare(
      `SELECT COUNT(*) as count FROM civic_items WHERE legislative_session = ?`
    ).bind(year).first() : null;
    
    const activeInYear = year ? await env.WY_DB.prepare(
      `SELECT COUNT(*) as count FROM civic_items WHERE legislative_session = ? AND inactive_at IS NULL`
    ).bind(year).first() : null;
    
    const needingAnalysisInYear = year ? await env.WY_DB.prepare(
      `SELECT COUNT(*) as count FROM civic_items 
       WHERE legislative_session = ? AND inactive_at IS NULL 
       AND status IN (${PENDING_STATUSES.map(() => "?").join(",")})
       AND level = 'statewide' AND jurisdiction_key = 'WY' AND source = 'lso'`
    ).bind(year, ...PENDING_STATUSES).first() : null;
    
    return {
      total_civic_items: total?.count ?? 0,
      civic_items_year: byYear?.count ?? 0,
      active_in_year: activeInYear?.count ?? 0,
      pending_status_in_year: needingAnalysisInYear?.count ?? 0,
      requested_year: year || "null",
    };
  } catch (err) {
    console.error("[SCAN_DEBUG] Failed to get diagnostics:", err.message);
    return { error: err.message };
  }
}

async function selectBillsForTopics(
  env,
  { limit = BATCH_SIZE, billId = null, year = null } = {}
) {
  const params = [];
  let sql = `
    SELECT 
      id,
      bill_number,
      title,
      ai_summary,
      ai_key_points,
      summary_error,
      legislative_session
    FROM civic_items
    WHERE ai_summary IS NOT NULL
      AND ai_summary <> ''
      AND inactive_at IS NULL
  `;

  if (year) {
    sql += ` AND legislative_session = ?`;
    params.push(year);
  }

  if (billId) {
    sql += ` AND id = ?`;
    params.push(billId);
  } else {
    sql += ` AND NOT EXISTS (
      SELECT 1 FROM hot_topic_civic_items htc WHERE htc.civic_item_id = civic_items.id
    )`;
  }

  sql += ` ORDER BY ai_summary_generated_at DESC LIMIT ?`;
  params.push(limit);

  const { results = [] } = await env.WY_DB.prepare(sql).bind(...params).all();
  return results;
}

async function runHotTopicsOnly(env, { limit = BATCH_SIZE, billId = null, year = null } = {}) {
  const bills = await selectBillsForTopics(env, { limit, billId, year });
  if (!bills.length) {
    return { processed: 0, topics_written: 0, results: [] };
  }

  const results = [];
  let topicsWritten = 0;

  for (const bill of bills) {
    try {
      const res = await ensureHotTopicForBill(env, null, {
        ...bill,
        summary_error: bill.summary_error || "ok",
      });
      if (res.status === "created") {
        topicsWritten += res.topic_count || 0;
      }
      results.push({
        bill_id: bill.id,
        bill_number: bill.bill_number,
        status: res.status,
        reason: res.reason || null,
        topic_count: res.topic_count || 0,
      });
    } catch (err) {
      results.push({
        bill_id: bill.id,
        bill_number: bill.bill_number,
        status: "error",
        reason: err.message,
        topic_count: 0,
      });
    }
  }

  return {
    processed: results.length,
    topics_written: topicsWritten,
    results,
  };
}

async function scanPendingBillsInternal(
  env,
  {
    batchSize = BATCH_SIZE,
    force = false,
    maxAgeDays = MAX_AGE_DAYS,
    resolveOnly = false,
    billId = null,
    dryRun = false,
    year = null,
    debug = false,
  } = {}
) {
  try {
    console.log(
      "🚀 Starting pending bill scan...",
      JSON.stringify({ batchSize, force, maxAgeDays, resolveOnly, billId, dryRun, year, debug })
    );
    const bills = await selectBillsForScan(env, { limit: batchSize, force, maxAgeDays, billId, year, debug });
    if (!bills.length) {
      console.log("ℹ️ No bills need topic analysis (force=%s, resolveOnly=%s)", force, resolveOnly);
      return {
        scanned: 0,
        results: [],
        skipped: false,
        reason: "no_bills",
        timestamp: new Date().toISOString(),
      };
    }
    console.log(`📋 Found ${bills.length} pending bills to scan`);

    const results = [];
    let savedTags = 0;
    let resolvedCount = 0;
    let summariesWritten = 0;
    let summariesSkipped = 0;

    for (const bill of bills) {
      try {
        console.log(`📄 Processing ${bill.bill_number}: ${bill.title}`);
        // Phase 0: Resolve document URL if not cached
        const resolverDebug =
          env[DOC_RESOLVER_DEBUG_FLAG] === "true" ||
          (typeof bill?.debug !== "undefined" && bill.debug === true);

        let cachedSource = await getCachedSource(env, bill.id);
        if (!cachedSource && env.TEST_SKIP_RESOLVE === "true") {
          cachedSource = bill.text_url
            ? { best_doc_url: bill.text_url, best_doc_kind: "test" }
            : null;
        }
        if (!cachedSource && !dryRun) {
          try {
            const resolved = await resolveDocument(env, {
              sourceKey: "wyoleg",
              year: bill.legislative_session,
              billNumber: bill.bill_number,
              debug: resolverDebug,
            });
            cachedSource = {
              best_doc_url: resolved.best?.url || null,
              best_doc_kind: resolved.best?.kind || null,
            };
            await upsertCivicItemSource(env, bill.id, resolved);
            resolvedCount++;
          } catch (resErr) {
            console.warn("⚠️ Doc resolve failed", bill.bill_number, resErr.message);
            await upsertCivicItemSource(env, bill.id, null, resErr.message);
          }
        }
        if (cachedSource?.best_doc_url) {
          console.log(
            `   → Document URL: ${cachedSource.best_doc_kind} (${cachedSource.best_doc_url.substring(0, 50)}...)`
          );
          bill.text_url = cachedSource.best_doc_url;
        } else {
          console.log("   → No document URL resolved");
        }

        // If resolveOnly=true, skip summaries and topic analysis
        if (resolveOnly) {
          results.push({
            bill_id: bill.id,
            bill_number: bill.bill_number,
            resolved: !!cachedSource?.best_doc_url,
            summary_generated: false,
            topics: [],
          });
          continue;
        }

        // Phase 1: Ensure bill summary is generated FIRST
        // (This populates ai_summary and ai_key_points in the bill object)
        let summaryResult = { plain_summary: bill.ai_summary || "", key_points: bill.ai_key_points || [], note: "" };
        if (!dryRun) {
          summaryResult = await ensureBillSummary(env, bill);
          if (summaryResult.plain_summary && summaryResult.plain_summary.length > 0) {
            summariesWritten++;
            console.log(`   → Summary: ${summaryResult.plain_summary.length} chars, ${summaryResult.key_points.length} key points`);
          } else {
            summariesSkipped++;
            console.log(`   → Summary skipped: need_more_text or validation failed`);
          }
        } else {
          console.log("   → Dry run: skipping summary generation");
        }
        
        // Update bill object with AI-generated summaries for better topic analysis
        bill.ai_summary = summaryResult.plain_summary;
        bill.ai_key_points = summaryResult.key_points;

        // Optional: create a two-word hot topic after summary success
        let hotTopicResult = null;
        const summaryReady =
          summaryResult.note === "ok" &&
          summaryResult.plain_summary &&
          summaryResult.plain_summary.length > 60;
        if (!dryRun && summaryReady) {
          hotTopicResult = await ensureHotTopicForBill(env, null, {
            ...bill,
            ai_summary: summaryResult.plain_summary,
            summary_error: summaryResult.note || "ok",
            ai_key_points: summaryResult.key_points,
          });
        }

        if (hotTopicResult?.topics?.length > 0 || hotTopicResult?.first_topic) {
          console.log(
            `   → Topics (${hotTopicResult.status}): ${hotTopicResult.topic_count || hotTopicResult?.topics?.length || 0} [source=${hotTopicResult.source || "unknown"}]`
          );
        }

        // Phase 2: Analyze bill against hot topics (now with better data)
        const analysis = dryRun ? { topics: [], other_flags: [] } : await analyzeBillForHotTopics(env, bill);
        if (!dryRun) {
          console.log(`   → Found ${analysis.topics.length} hot topics`);
        } else {
          console.log("   → Dry run: skipping hot-topic analysis");
        }

        // Phase 3: Save analysis to databases
        if (!dryRun) {
          await saveHotTopicAnalysis(env, bill.id, analysis);
          savedTags += analysis.topics.length;
        } else {
          console.log("   → Dry run: skipping tag persistence");
        }

        // Collect results
        const topicSlugs = analysis.topics.map(t => t.slug);
        const userPromptTemplates = analysis.topics.map(t => 
          buildUserPromptTemplate(bill.bill_number, t.label)
        );
        results.push({
          bill_id: bill.id,
          bill_number: bill.bill_number,
          topics: topicSlugs,
          user_prompt_templates: userPromptTemplates,
          summary_error: summaryResult.plain_summary ? null : (summaryResult.note || "empty_summary"),
          confidence_avg:
            topicSlugs.length > 0
              ? (
                  analysis.topics.reduce((sum, t) => sum + (t.confidence || 0), 0) /
                  topicSlugs.length
                ).toFixed(2)
              : null,
          summary_generated: summaryResult.plain_summary.length > 0,
          hot_topic: hotTopicResult?.first_topic || null,
          hot_topic_source: hotTopicResult?.source || null,
          hot_topic_confidence: Array.isArray(hotTopicResult?.topics)
            ? hotTopicResult.topics[0]?.confidence ?? null
            : null,
          hot_topic_status: hotTopicResult?.status || "none",
        });
      } catch (billErr) {
        console.error(`❌ Error processing bill ${bill.bill_number}:`, billErr);
        results.push({
          bill_id: bill.id,
          bill_number: bill.bill_number,
          error: billErr.message,
        });
      }
    }

    const logMsg = resolveOnly 
      ? `✅ Resolve-only complete: ${results.length} bills processed, ${resolvedCount} new sources resolved`
      : `✅ Scan complete: ${results.length} bills processed, ${savedTags} topic tags saved${dryRun ? " (dry run)" : ""}`;
    console.log(logMsg);
    
    return {
      scanned: results.length,
      scan_candidate_count: results.length,
      saved_tags: savedTags,
      sources_resolved: resolvedCount,
      summaries_written: summariesWritten,
      summaries_skipped: summariesSkipped,
      resolve_only: resolveOnly,
      dry_run: dryRun,
      results,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("❌ scanPendingBillsInternal error:", err);
    throw err;
  }
}

function isScannerEnabled(env) {
  return env.BILL_SCANNER_ENABLED === "true";
}

function isAuthorizedRequest(request, env) {
  // Allow localhost in dev (no token needed)
  const host = new URL(request.url).hostname;
  if (host === "127.0.0.1" || host === "localhost") {
    return true;
  }
  
  // For remote/production: require token
  const token = request.headers.get("x-internal-token");
  const expected = env.INTERNAL_SCAN_TOKEN;
  return expected && token && token === expected;
}

export async function runScheduledPendingBillScan(env, opts = {}) {
  if (!isScannerEnabled(env)) {
    console.log("⏸️ Skipping pending bill scan: BILL_SCANNER_ENABLED != true");
    return { scanned: 0, results: [], skipped: true, reason: "disabled" };
  }
  return scanPendingBillsInternal(env, { ...opts, force: opts.force ?? false });
}

export async function runAdminScan(env, opts = {}) {
  if (!isScannerEnabled(env)) {
    return { scanned: 0, results: [], skipped: true, reason: "disabled" };
  }
  return scanPendingBillsInternal(env, { ...opts });
}

export async function runAdminTopics(env, opts = {}) {
  if (!isScannerEnabled(env)) {
    return { processed: 0, results: [], skipped: true, reason: "disabled" };
  }
  return runHotTopicsOnly(env, { ...opts });
}

export async function handleScanPendingBills(request, env) {
  const url = new URL(request.url);
  const force =
    url.searchParams.get("force") === "1" ||
    url.searchParams.get("force") === "true";
  const billId = url.searchParams.get("billId") || null;
  const dryRun =
    url.searchParams.get("dryRun") === "1" ||
    url.searchParams.get("dryRun") === "true";
  const resolveOnly =
    url.searchParams.get("resolveOnly") === "1" ||
    url.searchParams.get("resolveOnly") === "true";

  if (!isScannerEnabled(env)) {
    console.log("⛔ scan blocked: scanner disabled");
    return new Response(JSON.stringify({ error: "Scanner disabled" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isAuthorizedRequest(request, env)) {
    console.log("⛔ scan blocked: unauthorized (missing/invalid X-Internal-Token)");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await scanPendingBillsInternal(env, {
      batchSize: BATCH_SIZE,
      force,
      resolveOnly,
      billId,
      dryRun,
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ handleScanPendingBills error:", err);
    return new Response(
      JSON.stringify({
        error: "scan_failed",
        message: err.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}



/**
 * handleTestOne(request, env)
 * 
 * **GET /api/internal/civic/test-one?bill_id=<id>&bill_number=<num>**
 * Milestone 1: Fetch and display a single pending bill (NO OpenAI call).
 * 
 * Query parameters:
 * - bill_id: OCD item ID (exact match)
 * - bill_number: Bill number like "HB 22" (case-insensitive, pending status)
 * - (none): Fetch most recent pending bill
 * 
 * Returns the raw civic_items row as JSON.
 * 
 * **POST /api/internal/civic/test-one?summaryOnly=true**
 * Milestone 2: Call OpenAI on one bill with cost-efficient options.
 * 
 * Query parameters:
 * - summaryOnly: true/false (default false, uses max_tokens=400 if true)
 * 
 * Returns:
 * {
 *   "bill_id": "ocd-bill/...",
 *   "bill_number": "HB 22",
 *   "title": "...",
 *   "topics": [...],
 *   "tokens": {
 *     "estimated_prompt_tokens": 125,
 *     "estimated_completion_tokens": 80,
 *     "actual_prompt_tokens": 120,
 *     "actual_completion_tokens": 78
 *   }
 * }
 */
export async function handleTestOne(request, env) {
  // 🔐 Restrict to localhost/127.0.0.1 for dev use only
  const host = new URL(request.url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    return new Response(JSON.stringify({ error: "Forbidden. Dev access only." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);

  // **GET** – Fetch one bill without OpenAI (Milestone 1)
  if (request.method === "GET") {
    try {
      const billId = url.searchParams.get("bill_id");
      const billNumber = url.searchParams.get("bill_number");

      console.log(`📄 Fetching single bill: bill_id=${billId}, bill_number=${billNumber}`);

      const bill = await getSinglePendingBill(env, {
        itemId: billId,
        billNumber: billNumber,
      });

      if (!bill) {
        return new Response(
          JSON.stringify({
            error: "bill_not_found",
            message: "No pending bill found with given criteria",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      console.log(`✅ Loaded bill: ${bill.bill_number} (${bill.id})`);
      return new Response(JSON.stringify(bill), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("❌ handleTestOne GET error:", err);
      return new Response(
        JSON.stringify({
          error: "test_failed",
          message: err.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  // **POST** – Analyze one bill with OpenAI (Milestone 2)
  if (request.method === "POST") {
    try {
      const summaryOnly = url.searchParams.get("summaryOnly") === "true";

      console.log(`🚀 Testing single-bill OpenAI call (summaryOnly=${summaryOnly})`);

      // Load the most recent pending bill
      const bill = await getSinglePendingBill(env);
      if (!bill) {
        return new Response(
          JSON.stringify({
            error: "bill_not_found",
            message: "No pending bills available",
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      console.log(`📄 Testing analysis on: ${bill.bill_number}`);

      // Call analyzer with options
      const analysis = await analyzeBillForHotTopics(env, bill, { summaryOnly });

      console.log(`✅ Analysis complete: ${analysis.topics.length} topics found`);

      // Return result with token tracking
      return new Response(
        JSON.stringify({
          bill_id: bill.id,
          bill_number: bill.bill_number,
          title: bill.title,
          summary: bill.summary,
          topics: analysis.topics.map(t => ({
            slug: t.slug,
            confidence: t.confidence,
            trigger_snippet: t.trigger_snippet,
          })),
          tokens: analysis.tokens,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (err) {
      console.error("❌ handleTestOne POST error:", err);
      return new Response(
        JSON.stringify({
          error: "test_failed",
          message: err.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  return new Response(JSON.stringify({ error: "method_not_allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * handleTestBillSummary(request, env)
 * 
 * **POST /api/internal/civic/test-bill-summary?bill_id=<id>**
 * Test the bill summary analyzer on a single bill.
 * 
 * Query parameters:
 * - bill_id: Specific bill ID (optional; if omitted, uses most recent)
 * - save: true/false (default true; save results to database)
 * 
 * Returns:
 * {
 *   "bill_id": "test-hb22",
 *   "bill_number": "HB 22",
 *   "title": "Property Tax Assessment Cap",
 *   "ai_summary": "2-3 sentence plain language explanation...",
 *   "ai_key_points": ["Point 1", "Point 2"],
 *   "cached": false,
 *   "saved": true
 * }
 */
export async function handleTestBillSummary(request, env) {
  // 🔐 Restrict to localhost/127.0.0.1 for dev use only
  const host = new URL(request.url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    return new Response(JSON.stringify({ error: "Forbidden. Dev access only." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(request.url);
    const billId = url.searchParams.get("bill_id");
    const shouldSave = url.searchParams.get("save") !== "false";

    console.log(`🧪 Testing bill summary analyzer (bill_id=${billId}, save=${shouldSave})`);

    // Fetch the bill
    const bill = await getSinglePendingBill(env, { itemId: billId });
    if (!bill) {
      return new Response(
        JSON.stringify({
          error: "bill_not_found",
          message: "No bill found with given ID",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`📄 Testing summary for: ${bill.bill_number} (${bill.id})`);

    // Check if already cached
    const isCached = bill.ai_summary_generated_at !== null;
    let analysis;

    if (isCached) {
      console.log(`📦 Using cached summary`);
      analysis = {
        plain_summary: bill.ai_summary || "",
        key_points: bill.ai_key_points ? JSON.parse(bill.ai_key_points) : [],
      };
    } else {
      console.log(`🤖 Generating new summary via OpenAI`);
      analysis = await analyzeBillSummary(env, bill);

      // Optionally save to database
      if (shouldSave && analysis.plain_summary) {
        console.log(`💾 Saving to database`);
        await saveBillSummary(env, bill.id, analysis);
      }
    }

    console.log(`✅ Summary ready: ${analysis.plain_summary.length} chars, ${analysis.key_points.length} points`);

    return new Response(
      JSON.stringify({
        bill_id: bill.id,
        bill_number: bill.bill_number,
        title: bill.title,
        summary: bill.summary,
        ai_summary: analysis.plain_summary,
        ai_key_points: analysis.key_points,
        cached: isCached,
        saved: shouldSave && analysis.plain_summary.length > 0,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("❌ handleTestBillSummary error:", err);
    return new Response(
      JSON.stringify({
        error: "test_failed",
        message: err.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function handleHotTopicDbCheck(request, env) {
  // Dev-only endpoint to check hot topic data from within the worker context
  const host = new URL(request.url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    return new Response(
      JSON.stringify({ error: "Forbidden. Dev access only." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const countResult = await env.WY_DB.prepare(`
      SELECT COUNT(*) as total_links
      FROM hot_topic_civic_items;
    `).first();
    
    const allRows = await env.WY_DB.prepare(`
      SELECT topic_id, civic_item_id, confidence, source, generated_at
      FROM hot_topic_civic_items
      LIMIT 10;
    `).all();

    return new Response(
      JSON.stringify({
        count: countResult,
        rows: allRows.results || [],
        row_count: (allRows.results || []).length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "db_check_failed",
        message: err.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
