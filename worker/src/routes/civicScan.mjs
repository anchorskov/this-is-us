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
} from "../lib/hotTopicsAnalyzer.mjs";

const PENDING_STATUSES = ["introduced", "in_committee", "pending_vote"];
const BATCH_SIZE = 5; // Scan 5 bills per request for cost & safety

/**
 * fetchPendingBills(env, limit)
 * 
 * Query WY_DB.civic_items for bills with pending status.
 * Ordered by most recent activity first.
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
      last_action_date
    FROM civic_items
    WHERE status IN (${placeholders})
    ORDER BY last_action_date DESC
    LIMIT ?
  `;
  const { results = [] } = await env.WY_DB.prepare(sql)
    .bind(...PENDING_STATUSES, limit)
    .all();
  return results;
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
    console.log("🚀 Starting pending bill scan...");
    const bills = await fetchPendingBills(env, BATCH_SIZE);
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

        // Collect results
        const topicSlugs = analysis.topics.map(t => t.slug);
        results.push({
          bill_id: bill.id,
          bill_number: bill.bill_number,
          topics: topicSlugs,
          confidence_avg:
            topicSlugs.length > 0
              ? (
                  analysis.topics.reduce((sum, t) => sum + (t.confidence || 0), 0) /
                  topicSlugs.length
                ).toFixed(2)
              : null,
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
    return new Response(
      JSON.stringify({
        scanned: results.length,
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
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
