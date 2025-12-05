/**
 * worker/src/routes/civicScan.mjs
 * 
 * Dev-only route for scanning pending Wyoming bills and linking them to hot topics via OpenAI.
 * 
 * **Route:** POST /api/internal/civic/scan-pending-bills
 * 
 * **Security:** Host-restricted to localhost/127.0.0.1 (dev only)
 * 
 * **Flow:**
 * 1. Query WY_DB for pending bills (status: introduced, in_committee, pending_vote)
 * 2. For each bill (batch size ~5):
 *    a. Call analyzeBillForHotTopics(env, bill) from hotTopicsAnalyzer
 *    b. Call saveHotTopicAnalysis(env, bill.id, analysis) to persist results
 * 3. Return summary of scanned bills and topics identified
 * 
 * **Response Shape:**
 * {
 *   "scanned": 3,
 *   "results": [
 *     {
 *       "bill_id": "ocd-bill/...",
 *       "bill_number": "HB 22",
 *       "topics": ["property-tax-relief", "housing-land-use"]
 *     }
 *   ]
 * }
 */

import { analyzeBillForHotTopics, saveHotTopicAnalysis } from "../lib/hotTopicsAnalyzer.mjs";

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
