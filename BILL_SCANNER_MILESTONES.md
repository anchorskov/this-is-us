# Bill Scanner Testing – Four Practical Milestones

**Date:** December 5, 2025  
**Status:** ✅ **READY FOR MILESTONE TESTING**  
**Cost Model:** gpt-4o at ~$0.00015 USD per bill

---

## Overview

This guide walks through four clear milestones for testing the Wyoming bill scanner. Each milestone builds on the previous one, increasing in complexity and API usage.

### The Four Milestones

1. **Milestone 1:** Load a single pending bill (no OpenAI cost)
2. **Milestone 2:** Run cost-efficient analyzer on one bill + token tracking
3. **Milestone 3:** Observe token estimates vs actual OpenAI usage
4. **Milestone 4:** Verify data storage and schema for future tracking

---

## Prerequisites

Before starting, ensure:

```bash
# Check environment is set up
echo "OPENAI_API_KEY=$OPENAI_API_KEY"  # Should show your key
echo "BILL_SCANNER_ENABLED=$BILL_SCANNER_ENABLED"

# If not set:
export OPENAI_API_KEY="sk-..."
export BILL_SCANNER_ENABLED=true
```

---

## Milestone 1: Load a Single Pending Bill

**Goal:** Fetch and display one pending bill without calling OpenAI  
**Cost:** $0 (database query only)  
**Time:** 5 minutes

### Helper Function Used
```javascript
getSinglePendingBill(env, options)
// Fetches one bill from WY_DB.civic_items (status: introduced, in_committee, pending_vote)
// Includes: bill_number, title, summary, subject_tags, last_action, last_action_date
```

### Test Route
```
GET /api/internal/civic/test-one
GET /api/internal/civic/test-one?bill_id=<ocd-id>
GET /api/internal/civic/test-one?bill_number=HB%2022
```

### Step 1: Start wrangler dev

```bash
cd /home/anchor/projects/this-is-us/worker
npx wrangler dev --local
```

**Expected output:**
```
✅ Cloudflare Workers local development
→ Server ready at http://127.0.0.1:8787
```

Do NOT close this terminal.

### Step 2: Fetch the most recent pending bill (no filters)

**Terminal 2:**

```bash
curl -s http://127.0.0.1:8787/api/internal/civic/test-one | jq .
```

**Expected response:**
```json
{
  "id": "ocd-bill/us-wy:bill/2025/HB%2022",
  "bill_number": "HB 22",
  "title": "Property Tax Relief Act",
  "summary": "This bill proposes to cap property tax increases at 3% annually...",
  "subject_tags": "taxation, property",
  "status": "introduced",
  "legislative_session": 2025,
  "chamber": "lower",
  "last_action": "Introduced in committee",
  "last_action_date": "2025-01-15T10:30:00Z",
  "text_url": "https://..."
}
```

**Logs in Terminal 1:**
```
📄 Fetching single bill: bill_id=null, bill_number=null
✅ Loaded bill: HB 22 (ocd-bill/us-wy:bill/2025/HB%2022)
```

### Step 3: Fetch a specific bill by bill_number

```bash
curl -s 'http://127.0.0.1:8787/api/internal/civic/test-one?bill_number=HB%2022' | jq '.bill_number, .title'
```

**Expected output:**
```json
"HB 22"
"Property Tax Relief Act"
```

### Step 4: Fetch by exact OCD item ID

```bash
curl -s 'http://127.0.0.1:8787/api/internal/civic/test-one?bill_id=ocd-bill/us-wy:bill/2025/HB%2022' | jq '.id, .bill_number'
```

**Expected output:**
```json
"ocd-bill/us-wy:bill/2025/HB%2022"
"HB 22"
```

---

## Milestone 2: Run Cost-Efficient OpenAI Analysis

**Goal:** Call OpenAI analyzer on one bill with token tracking  
**Cost:** ~$0.00015 USD (single bill)  
**Time:** 10 minutes

### Updated Analyzer Function
```javascript
analyzeBillForHotTopics(env, bill, opts = {})
// NEW: opts.summaryOnly = true reduces max_tokens to 400 (vs default 500)
// Returns: { topics, other_flags, tokens: { estimated_prompt_tokens, actual_prompt_tokens, ... } }
```

### Test Route
```
POST /api/internal/civic/test-one
POST /api/internal/civic/test-one?summaryOnly=true
```

### Step 1: Run analysis with default cost settings (max_tokens=500)

**Terminal 2:**

```bash
curl -s -X POST http://127.0.0.1:8787/api/internal/civic/test-one | jq '.'
```

**Expected response:**
```json
{
  "bill_id": "ocd-bill/us-wy:bill/2025/HB%2022",
  "bill_number": "HB 22",
  "title": "Property Tax Relief Act",
  "summary": "This bill proposes...",
  "topics": [
    {
      "slug": "property-tax-relief",
      "confidence": 0.92,
      "trigger_snippet": "cap property tax increases at 3% annually"
    }
  ],
  "tokens": {
    "estimated_prompt_tokens": 156,
    "estimated_completion_tokens": 80,
    "actual_prompt_tokens": 152,
    "actual_completion_tokens": 78
  },
  "timestamp": "2025-12-05T18:42:00.000Z"
}
```

**Logs in Terminal 1:**
```
🚀 Testing single-bill OpenAI call (summaryOnly=false)
📄 Testing analysis on: HB 22
💰 OpenAI usage [ocd-bill/us-wy:bill/2025/HB%2022]:
   Estimated: 156 prompt + 80 completion = 236 total
   Actual:    152 prompt + 78 completion = 230 total
   Variance:  prompt -4, completion -2
✅ Analysis complete: 1 topics found
```

### Step 2: Run with summaryOnly=true (cost-optimized)

```bash
curl -s -X POST 'http://127.0.0.1:8787/api/internal/civic/test-one?summaryOnly=true' | jq '.tokens'
```

**Expected tokens output (will be slightly lower):**
```json
{
  "estimated_prompt_tokens": 156,
  "estimated_completion_tokens": 64,
  "actual_prompt_tokens": 152,
  "actual_completion_tokens": 62
}
```

**Logs in Terminal 1:**
```
🚀 Testing single-bill OpenAI call (summaryOnly=true)
💰 OpenAI usage [ocd-bill/us-wy:bill/2025/HB%2022]:
   Estimated: 156 prompt + 64 completion = 220 total
   Actual:    152 prompt + 62 completion = 214 total
   Variance:  prompt -4, completion -2
```

### Step 3: Test multiple times to understand token variance

Run 3 scans on different bills:

```bash
# Bill 1
curl -s -X POST http://127.0.0.1:8787/api/internal/civic/test-one | jq '{bill: .bill_number, actual_tokens: (.tokens.actual_prompt_tokens + .tokens.actual_completion_tokens)}'

# Bill 2 (get next pending)
curl -s -X POST http://127.0.0.1:8787/api/internal/civic/test-one | jq '{bill: .bill_number, actual_tokens: (.tokens.actual_prompt_tokens + .tokens.actual_completion_tokens)}'

# Bill 3
curl -s -X POST http://127.0.0.1:8787/api/internal/civic/test-one | jq '{bill: .bill_number, actual_tokens: (.tokens.actual_prompt_tokens + .tokens.actual_completion_tokens)}'
```

**Expected output (typical range):**
```json
{"bill":"HB 22","actual_tokens":230}
{"bill":"HB 23","actual_tokens":218}
{"bill":"SF 2","actual_tokens":245}
```

**Observation:** Tokens vary based on bill length, but typically 200–250 total per bill at gpt-4o pricing ~$0.0002 each.

---

## Milestone 3: Observe Token Estimates vs Actual

**Goal:** Understand how estimation accuracy improves over time  
**Cost:** ~$0.001 USD for 5–10 scans  
**Time:** 15 minutes

### Token Estimation Algorithm

```javascript
// BEFORE OpenAI call:
const systemTokens = SYSTEM_PROMPT.length / 4;      // ~335 tokens
const userTokens = userPrompt.length / 4;           // ~40–80 tokens (varies by bill)
const estimatedPromptTokens = systemTokens + userTokens;  // ~375–415
const estimatedCompletionTokens = maxTokens * 0.3;  // 150 at 500 max, 120 at 400 max

// AFTER OpenAI call:
const actualPromptTokens = data.usage.prompt_tokens;        // From API
const actualCompletionTokens = data.usage.completion_tokens; // From API
```

### Test: Run 10 scans and track variance

```bash
# Create a simple bash loop to run 10 scans and collect token data
for i in {1..10}; do
  curl -s -X POST http://127.0.0.1:8787/api/internal/civic/test-one | \
    jq '{bill: .bill_number, est_prompt: .tokens.estimated_prompt_tokens, actual_prompt: .tokens.actual_prompt_tokens, variance: (.tokens.actual_prompt_tokens - .tokens.estimated_prompt_tokens)}'
  sleep 1
done | tee /tmp/token_variance.json
```

**Expected output (sample):**
```json
{"bill":"HB 22","est_prompt":156,"actual_prompt":152,"variance":-4}
{"bill":"HB 23","est_prompt":145,"actual_prompt":141,"variance":-4}
{"bill":"SF 2","est_prompt":168,"actual_prompt":165,"variance":-3}
{"bill":"HB 24","est_prompt":152,"actual_prompt":149,"variance":-3}
...
```

### Analysis

1. **Estimation accuracy:** Typically within ±5% of actual
2. **Systematic bias:** Estimates tend to be slightly high (conservative, safe)
3. **Cost impact:** If averaging -3 tokens per bill:
   - 10 bills: Save ~3 tokens × 10 = 30 tokens = ~$0.000045 total
   - 100 bills: Save ~300 tokens = ~$0.00045 total
   - Not significant for small batches, matters at scale

### View logs to understand token flow

In **Terminal 1** (wrangler dev), you'll see patterns like:

```
💰 OpenAI usage [ocd-bill/us-wy:bill/2025/HB%2022]:
   Estimated: 156 prompt + 80 completion = 236 total
   Actual:    152 prompt + 78 completion = 230 total
   Variance:  prompt -4, completion -2
```

---

## Milestone 4: Verify Data Storage & Future Tracking

**Goal:** Confirm data is saved correctly; identify future schema improvements  
**Cost:** $0 (database queries only)  
**Time:** 10 minutes

### Current Schema (Milestone 4.1: Verify Existing)

**WY_DB.civic_item_ai_tags:**
```sql
id                  INTEGER PRIMARY KEY
item_id            TEXT NOT NULL      -- bill OCD ID
topic_slug         TEXT NOT NULL      -- e.g., "property-tax-relief"
confidence         REAL NOT NULL      -- 0.0 to 1.0
trigger_snippet    TEXT               -- quoted/paraphrased text
created_at         TEXT DEFAULT NOW   -- timestamp
```

**Test:** Run one POST scan, then query the database

```bash
# In Terminal 2, run one scan
curl -s -X POST http://127.0.0.1:8787/api/internal/civic/test-one > /tmp/scan_result.json

# Extract the bill ID
BILL_ID=$(jq -r '.bill_id' /tmp/scan_result.json)
echo "Scanned bill ID: $BILL_ID"

# Query WY_DB for tags
cd /home/anchor/projects/this-is-us/worker
npx wrangler d1 execute WY_DB --local \
  --command "SELECT topic_slug, confidence, trigger_snippet FROM civic_item_ai_tags WHERE item_id = '$BILL_ID';" \
  --json | jq '.[0].results'
```

**Expected output:**
```json
[
  {
    "topic_slug": "property-tax-relief",
    "confidence": 0.92,
    "trigger_snippet": "cap property tax increases at 3%"
  }
]
```

### Cross-Database Verification (Milestone 4.2: Links)

**Test:** Verify link to EVENTS_DB.hot_topic_civic_items

```bash
# Query EVENTS_DB for linked bills
npx wrangler d1 execute EVENTS_DB --local \
  --command "SELECT ht.slug, COUNT(htci.civic_item_id) as linked FROM hot_topics ht 
             LEFT JOIN hot_topic_civic_items htci ON ht.id = htci.topic_id
             GROUP BY ht.id;" \
  --json | jq '.[0].results'
```

**Expected output:**
```json
[
  {"slug":"property-tax-relief","linked":1},
  {"slug":"water-rights","linked":0},
  ...
]
```

### Future Tracking Ideas (Milestone 4.3: Schema Enhancements)

The code includes a comment block in `saveHotTopicAnalysis()` listing candidate fields for future migrations:

```javascript
/**
 * **Future tracking ideas (Milestone 4):**
 * - model (TEXT): "gpt-4o" (or future models)
 * - estimated_prompt_tokens (INTEGER): Tokens before API call
 * - actual_prompt_tokens (INTEGER): Actual usage from OpenAI response
 * - actual_completion_tokens (INTEGER): Actual completion tokens
 * - raw_analysis_json (TEXT): Full JSON response for debugging
 * 
 * These would enable:
 * - Cost tracking and billing per scan
 * - Model performance evaluation
 * - Debugging when confidence scores don't match expectations
 */
```

**When to implement:** After you've run 100+ bills and identified:
- Which fields are most useful for analysis
- Cost tracking needs
- Model drift (confidence accuracy over time)

---

## Re-scan and Deduplication (Milestone 4.4: Safety Check)

**Goal:** Confirm re-running scan clears old data correctly

### Test 1: Run scan twice on same bill

```bash
# First scan
curl -s -X POST http://127.0.0.1:8787/api/internal/civic/test-one > /tmp/scan1.json
BILL_ID=$(jq -r '.bill_id' /tmp/scan1.json)

# Check count
cd /home/anchor/projects/this-is-us/worker
npx wrangler d1 execute WY_DB --local \
  --command "SELECT COUNT(*) as count FROM civic_item_ai_tags WHERE item_id = '$BILL_ID';" \
  --json | jq '.[0].results[0].count'

# Second scan (will fetch next bill, but let's imagine we re-scanned the same)
# In production, this would clear and re-insert
```

**Expected behavior:**
- First scan: count = number of topics matched (e.g., 1 or 2)
- After DELETE in saveHotTopicAnalysis: count = 0
- After re-insert: count = same as first scan (no duplicates)

### Test 2: Confirm hot_topic_civic_items also gets cleaned

```bash
# Check how many links exist for our bill
npx wrangler d1 execute EVENTS_DB --local \
  --command "SELECT COUNT(civic_item_id) as linked_count FROM hot_topic_civic_items 
             WHERE civic_item_id = '$BILL_ID';" \
  --json | jq '.[0].results[0].linked_count'
```

**Expected:** No duplicates; safe to re-run scans multiple times

---

## Quick Reference: Cost Estimation

### Per-Bill Costs (gpt-4o)

| Scenario | Prompt Tokens | Completion | Total Tokens | Cost (USD) |
|----------|---------------|-----------|--------------|-----------|
| Single bill (normal) | 152 | 78 | 230 | ~$0.00015 |
| Single bill (summaryOnly) | 152 | 62 | 214 | ~$0.00012 |
| 5-bill batch | 800 | 400 | 1,200 | ~$0.00075 |
| 10-bill batch | 1,600 | 800 | 2,400 | ~$0.0015 |
| 40-bill session | 6,400 | 3,200 | 9,600 | ~$0.006 |

**OpenAI gpt-4o pricing:**
- Input: ~$0.0015 per 1K tokens
- Output: ~$0.006 per 1K tokens
- Typical ratio: 70% input, 30% output

---

## Troubleshooting

### Error: "bill_not_found" on GET /api/internal/civic/test-one

**Cause:** No pending bills in WY_DB  
**Fix:** Sync bills from OpenStates first

```bash
curl http://127.0.0.1:8787/api/dev/openstates/sync?session=2025&limit=20
# Wait 30 seconds for sync to complete
curl -s http://127.0.0.1:8787/api/internal/civic/test-one | jq '.bill_number'
```

### Error: "BILL_SCANNER_ENABLED not set" on POST tests

**Cause:** Feature flag not exported  
**Fix:**

```bash
export BILL_SCANNER_ENABLED=true
# Kill and restart wrangler dev
pkill -f "wrangler dev" || true
npx wrangler dev --local
```

### Error: "⚠️ Missing OPENAI_API_KEY" in logs

**Cause:** OpenAI API key not set  
**Fix:**

```bash
export OPENAI_API_KEY="sk-..."
# Kill and restart wrangler dev
pkill -f "wrangler dev" || true
npx wrangler dev --local
```

### No token data in response

**Cause:** OpenAI API didn't return usage info (rare)  
**Check logs:** Look for `💰 OpenAI usage` lines in wrangler dev console

---

## Summary: Four Milestones Checklist

- [ ] **Milestone 1:** Load single bill via GET /api/internal/civic/test-one
- [ ] **Milestone 2:** Run analyzer via POST /api/internal/civic/test-one
- [ ] **Milestone 3:** Observe token estimates vs actual in logs
- [ ] **Milestone 4:** Verify civic_item_ai_tags saved correctly
- [ ] **Milestone 4.2:** Verify hot_topic_civic_items linked correctly
- [ ] **Milestone 4.3:** Reviewed future tracking ideas (comments in code)
- [ ] **Milestone 4.4:** Confirmed re-scan clears old data safely

---

## Next: Production Scanning

Once all milestones pass, you're ready for:

1. **Batch scanning:** Use POST /api/internal/civic/scan-pending-bills (5 bills per request)
2. **Production deployment:** Apply migrations, deploy worker code
3. **Scheduled scanning:** Replace HTTP endpoint with Cron event
4. **Monitoring:** Track costs, accuracy, match distribution

See `BILL_SCANNER_SECURITY.md` for production safeguards.

---

**Status:** ✅ **MILESTONES READY FOR TESTING**  
**Last Updated:** December 5, 2025
