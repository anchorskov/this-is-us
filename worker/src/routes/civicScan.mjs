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
 * 
 * **Security:** Host-restricted to localhost/127.0.0.1 (dev only)
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
} from "../lib/billSummaryAnalyzer.mjs";

const PENDING_STATUSES = ["introduced", "in_committee", "pending_vote"];
const BATCH_SIZE = 5; // Scan 5 bills per request for cost & safety

/**
 * fetchPendingBills(env, limit)
 * 
 * Query WY_DB.civic_items for bills with pending status.
 * Prioritizes bills without AI summaries, then by most recent activity.
 */
async function fetchPendingBills(env, limit = BATCH_SIZE) {
  const placeholders = PENDING_STATUSES.map(() => "?").join(",");
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
    FROM civic_items
    WHERE status IN (${placeholders})
    ORDER BY 
      CASE WHEN ai_summary IS NULL OR ai_summary = '' THEN 0 ELSE 1 END,
      last_action_date DESC
    LIMIT ?
  `;
  const { results = [] } = await env.WY_DB.prepare(sql)
    .bind(...PENDING_STATUSES, limit)
    .all();
  return results;
}

async function scanPendingBillsInternal(env, { batchSize = BATCH_SIZE } = {}) {
  try {
    console.log("🚀 Starting pending bill scan...");
    const bills = await fetchPendingBills(env, batchSize);
    console.log(`📋 Found ${bills.length} pending bills to scan`);

    const results = [];

    for (const bill of bills) {
      try {
        console.log(`📄 Analyzing ${bill.bill_number}: ${bill.title}`);
        
        // Phase 1: Analyze bill against hot topics
        const analysis = await analyzeBillForHotTopics(env, bill);
        console.log(`   → Found ${analysis.topics.length} hot topics`);

        // Phase 2: Save analysis to databases
        await saveHotTopicAnalysis(env, bill.id, analysis);

        // Phase 3: Ensure bill summary is generated and saved
        // (Generates summary via OpenAI if not already cached)
        const summaryResult = await ensureBillSummary(env, bill);
        console.log(`   → Summary: ${summaryResult.plain_summary.length} chars, ${summaryResult.key_points.length} key points`);

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
          confidence_avg:
            topicSlugs.length > 0
              ? (
                  analysis.topics.reduce((sum, t) => sum + (t.confidence || 0), 0) /
                  topicSlugs.length
                ).toFixed(2)
              : null,
          summary_generated: summaryResult.plain_summary.length > 0,
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

    console.log(`✅ Scan complete: ${results.length} bills processed`);
    return {
      scanned: results.length,
      results,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("❌ scanPendingBillsInternal error:", err);
    throw err;
  }
}

export async function runScheduledPendingBillScan(env, opts = {}) {
  if (env.BILL_SCANNER_ENABLED !== "true") {
    console.log("⏸️ Skipping pending bill scan: BILL_SCANNER_ENABLED != true");
    return { scanned: 0, results: [], skipped: true, reason: "disabled" };
  }
  return scanPendingBillsInternal(env, opts);
}

export async function handleScanPendingBills(request, env) {
  // Feature flag guard
  if (env.BILL_SCANNER_ENABLED !== "true") {
    return new Response(JSON.stringify({ error: "Scanner disabled" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 🔐 Restrict to localhost/127.0.0.1 for dev use only
  const host = new URL(request.url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    return new Response(JSON.stringify({ error: "Forbidden. Dev access only." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await scanPendingBillsInternal(env, { batchSize: BATCH_SIZE });
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
