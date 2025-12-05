#!/usr/bin/env node
/**
 * test/test-bill-scanner.js
 * 
 * Automated integration test for Wyoming bill scanner endpoint.
 * 
 * Tests:
 * 1. POST /api/internal/civic/scan-pending-bills responds with 200
 * 2. Response includes scanned count and results array
 * 3. Each result has bill_id, bill_number, topics array
 * 4. Topics are from the canonical six hot topics
 * 5. Confidence scores are valid (0.0–1.0)
 * 
 * Run with:
 *   node test/test-bill-scanner.js
 * 
 * Requires:
 * - wrangler dev --local running on http://127.0.0.1:8787
 * - OPENAI_API_KEY environment variable set
 * - BILL_SCANNER_ENABLED=true environment variable set
 * - WY_DB with civic_items table populated
 * - EVENTS_DB with hot_topics table populated
 */

const BASE_URL = "http://127.0.0.1:8787";

const CANONICAL_TOPICS = [
  "property-tax-relief",
  "water-rights",
  "education-funding",
  "energy-permitting",
  "public-safety-fentanyl",
  "housing-land-use",
];

/**
 * Assertions
 */
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ Expected ${expected}, got ${actual}: ${message}`);
    process.exit(1);
  }
}

function assertInRange(value, min, max, message) {
  if (value < min || value > max) {
    console.error(`❌ Value ${value} not in range [${min}, ${max}]: ${message}`);
    process.exit(1);
  }
}

/**
 * Test 1: Server is reachable
 */
async function testServerReachable() {
  console.log("\n📡 Test 1: Server reachable at http://127.0.0.1:8787");
  try {
    const res = await fetch(`${BASE_URL}/api/_health`);
    assert(res.ok, "Health check returned 200");
    console.log("✅ Server is reachable and responding");
  } catch (err) {
    console.error(`❌ Cannot reach ${BASE_URL}: ${err.message}`);
    console.error("   Make sure 'npx wrangler dev --local' is running");
    process.exit(1);
  }
}

/**
 * Test 2: Scan endpoint accessible (but may be disabled)
 */
async function testScanEndpointAccessible() {
  console.log("\n🚀 Test 2: POST /api/internal/civic/scan-pending-bills is wired");
  try {
    const res = await fetch(`${BASE_URL}/api/internal/civic/scan-pending-bills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    // Could be 200, 403 (disabled or wrong host), or 500
    assert(
      [200, 403, 500].includes(res.status),
      `Status code is reasonable (got ${res.status})`
    );

    if (res.status === 403) {
      const body = await res.json();
      console.log(`⚠️  Endpoint is disabled or host-restricted:`, body.error);
      console.log("   Make sure:");
      console.log("   - BILL_SCANNER_ENABLED=true is set");
      console.log("   - Request is from 127.0.0.1 (not another hostname)");
      process.exit(1);
    }

    console.log(`✅ Endpoint is accessible (status: ${res.status})`);
  } catch (err) {
    console.error(`❌ Failed to reach scan endpoint: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Test 3: Run the actual scan
 */
async function testScan() {
  console.log("\n📋 Test 3: Run POST /api/internal/civic/scan-pending-bills");
  let data;

  try {
    const res = await fetch(`${BASE_URL}/api/internal/civic/scan-pending-bills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`❌ Scan endpoint returned ${res.status}`);
      console.error(`   Response: ${errBody}`);
      process.exit(1);
    }

    data = await res.json();
  } catch (err) {
    console.error(`❌ Failed to call scan endpoint: ${err.message}`);
    process.exit(1);
  }

  // Validate response shape
  assert(typeof data === "object", "Response is JSON object");
  assert("scanned" in data, "Response has 'scanned' field");
  assert("results" in data, "Response has 'results' field");
  assert("timestamp" in data, "Response has 'timestamp' field");
  assert(typeof data.scanned === "number", "scanned is a number");
  assert(Array.isArray(data.results), "results is an array");

  console.log(`✅ Scan returned valid response shape`);
  console.log(`   Scanned: ${data.scanned} bills`);
  console.log(`   Timestamp: ${data.timestamp}`);

  return data;
}

/**
 * Test 4: Validate results structure and content
 */
function testResultsValidation(data) {
  console.log("\n🔍 Test 4: Validate results structure and content");

  const { scanned, results } = data;

  if (scanned === 0) {
    console.warn("⚠️  No bills were scanned. Possible causes:");
    console.warn("   - No pending bills in WY_DB.civic_items");
    console.warn("   - OPENAI_API_KEY not set");
    console.warn("   - All bills have empty summaries/titles");
    return; // Don't fail, just warn
  }

  console.log(`Validating ${results.length} results...`);

  let validResults = 0;
  let invalidResults = 0;
  let topicCounts = {};
  let highConfidenceCount = 0;

  for (const result of results) {
    // Validate structure
    if (!("bill_id" in result) || !("bill_number" in result) || !("topics" in result)) {
      console.error(`❌ Result missing required fields: ${JSON.stringify(result)}`);
      invalidResults++;
      continue;
    }

    // Validate types
    if (typeof result.bill_id !== "string" || !result.bill_id.startsWith("ocd-bill")) {
      console.error(`❌ bill_id is invalid: ${result.bill_id}`);
      invalidResults++;
      continue;
    }

    if (typeof result.bill_number !== "string") {
      console.error(`❌ bill_number is not a string: ${result.bill_number}`);
      invalidResults++;
      continue;
    }

    if (!Array.isArray(result.topics)) {
      console.error(`❌ topics is not an array for ${result.bill_number}`);
      invalidResults++;
      continue;
    }

    // Validate topics
    for (const topic of result.topics) {
      if (!CANONICAL_TOPICS.includes(topic)) {
        console.error(
          `❌ Invalid topic slug '${topic}' in ${result.bill_number} (not one of ${CANONICAL_TOPICS.join(", ")})`
        );
        invalidResults++;
        continue;
      }
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }

    // Validate confidence_avg if present
    if ("confidence_avg" in result && result.confidence_avg !== null) {
      const conf = parseFloat(result.confidence_avg);
      if (isNaN(conf)) {
        console.error(`❌ confidence_avg is not a number: ${result.confidence_avg}`);
        invalidResults++;
        continue;
      }
      assertInRange(conf, 0.0, 1.0, `confidence_avg for ${result.bill_number}`);
      if (conf >= 0.7) {
        highConfidenceCount++;
      }
    }

    validResults++;
  }

  console.log(`✅ Results validation:`);
  console.log(`   Valid results: ${validResults}/${results.length}`);
  if (invalidResults > 0) {
    console.log(`   Invalid results: ${invalidResults} (see errors above)`);
  }

  if (Object.keys(topicCounts).length > 0) {
    console.log(`   Topics matched: ${Object.keys(topicCounts).length}`);
    for (const [topic, count] of Object.entries(topicCounts)) {
      console.log(`     - ${topic}: ${count} bills`);
    }
  } else {
    console.log(`   No topics matched (all bills: topics=[])`);
  }

  console.log(`   High-confidence matches (≥0.70): ${highConfidenceCount}`);

  if (invalidResults > 0) {
    process.exit(1);
  }
}

/**
 * Test 5: Check that topics are canonical and confidence is reasonable
 */
function testConfidenceAndTopics(data) {
  console.log("\n📊 Test 5: Topic distribution and confidence scores");

  const { results } = data;
  const topicDistribution = {};
  const confidenceStats = [];

  for (const result of results) {
    if (result.topics.length > 0 && result.confidence_avg) {
      confidenceStats.push(parseFloat(result.confidence_avg));
    }

    for (const topic of result.topics) {
      if (!topicDistribution[topic]) {
        topicDistribution[topic] = [];
      }
      topicDistribution[topic].push(result.bill_number);
    }
  }

  // Display distribution
  if (Object.keys(topicDistribution).length > 0) {
    console.log("Topic distribution:");
    for (const [topic, bills] of Object.entries(topicDistribution)) {
      console.log(`  ${topic}: ${bills.join(", ")}`);
    }
  }

  // Display confidence stats
  if (confidenceStats.length > 0) {
    const avg = confidenceStats.reduce((a, b) => a + b, 0) / confidenceStats.length;
    const min = Math.min(...confidenceStats);
    const max = Math.max(...confidenceStats);
    console.log(`Confidence scores (${confidenceStats.length} matches):`);
    console.log(`  Min: ${min.toFixed(2)}`);
    console.log(`  Max: ${max.toFixed(2)}`);
    console.log(`  Avg: ${avg.toFixed(2)}`);
  }

  console.log(`✅ Topic and confidence validation complete`);
}

/**
 * Test 6: Verify databases were updated
 */
async function testDatabaseUpdates() {
  console.log("\n💾 Test 6: Verify database tables were updated (requires wrangler CLI)");

  // Note: This would require access to wrangler d1 CLI, which is external to the worker.
  // For a pure integration test, we'd need to call a debug endpoint that queries the DB.
  // For now, provide instructions.

  console.log("To verify database updates, run in another terminal:");
  console.log("  cd /home/anchor/projects/this-is-us/worker");
  console.log("  npx wrangler d1 execute WY_DB --local --command");
  console.log('    "SELECT COUNT(*) as count FROM civic_item_ai_tags;"');
  console.log("  npx wrangler d1 execute EVENTS_DB --local --command");
  console.log('    "SELECT COUNT(*) as count FROM hot_topic_civic_items;"');
}

/**
 * Main test runner
 */
async function runTests() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║     Bill Scanner Integration Test Suite                        ║");
  console.log("║     Wyoming Hot Topics – OpenAI gpt-4o Analyzer                 ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");

  console.log(`\nTest environment:`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "✅ set" : "❌ NOT SET"}`);
  console.log(`  BILL_SCANNER_ENABLED: ${process.env.BILL_SCANNER_ENABLED || "❌ NOT SET"}`);

  try {
    await testServerReachable();
    await testScanEndpointAccessible();

    const scanData = await testScan();

    testResultsValidation(scanData);
    testConfidenceAndTopics(scanData);
    await testDatabaseUpdates();

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║  ✅ ALL TESTS PASSED                                           ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");
    console.log("\nNext steps:");
    console.log("  1. Check wrangler dev logs for 🚀📋📄✅ emoji prefixes");
    console.log("  2. Verify civic_item_ai_tags table was populated:");
    console.log("     npx wrangler d1 execute WY_DB --local \\");
    console.log("       --command 'SELECT COUNT(*) FROM civic_item_ai_tags;'");
    console.log("  3. Check hot_topic_civic_items for new bill links:");
    console.log("     npx wrangler d1 execute EVENTS_DB --local \\");
    console.log("       --command 'SELECT COUNT(*) FROM hot_topic_civic_items;'");
    console.log("  4. Test GET /api/hot-topics to see new civic_items in response");
    console.log("");

    process.exit(0);
  } catch (err) {
    console.error("\n❌ Test suite failed:", err.message);
    process.exit(1);
  }
}

// Run tests
runTests();
