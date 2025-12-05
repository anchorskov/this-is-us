# Bill Scanner Test Plan – Wyoming Hot Topics

**Date:** December 5, 2025  
**Purpose:** End-to-end validation of bill scanner setup and functionality

---

## Part 1: Setup & Prerequisites

### Environment Check
Verify you have the necessary tools:
```bash
# Check Node/npm
node --version  # v18+ recommended
npm --version

# Check wrangler (should be in worker/)
cd /home/anchor/projects/this-is-us/worker
npx wrangler --version

# Verify OPENAI_API_KEY is set (used by sandbox.js and hotTopicsAnalyzer.mjs)
echo "OPENAI_API_KEY=$OPENAI_API_KEY"  # should show your key
```

### Local Database State Check
```bash
cd /home/anchor/projects/this-is-us/worker

# Confirm WY_DB migrations applied (should see migrations 0001–0009)
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*/d1.sqlite \
  "SELECT name FROM d1_migrations WHERE name LIKE '000%' ORDER BY id;" 2>/dev/null || \
  npx wrangler d1 execute WY_DB --local \
    --command "SELECT name FROM d1_migrations ORDER BY id;" --json | jq '.[0].results[].name' 2>/dev/null

# Confirm EVENTS_DB migrations applied (should see 0001–0003)
npx wrangler d1 execute EVENTS_DB --local \
  --command "SELECT name FROM d1_migrations ORDER BY id;" --json | jq '.[0].results[].name' 2>/dev/null

# Check that 6 hot topics are loaded
npx wrangler d1 execute EVENTS_DB --local \
  --command "SELECT COUNT(*) as count FROM hot_topics WHERE is_active = 1;" --json | jq '.[0].results[0].count'

# Check that at least 5 pending bills exist
npx wrangler d1 execute WY_DB --local \
  --command "SELECT COUNT(*) as count FROM civic_items WHERE status IN ('introduced', 'in_committee', 'pending_vote');" --json | jq '.[0].results[0].count'
```

---

## Part 2: Start Dev Server

### Terminal 1: Launch wrangler dev
```bash
cd /home/anchor/projects/this-is-us/worker

# Optional: set BILL_SCANNER_ENABLED before startup
export BILL_SCANNER_ENABLED=true

# Start dev server (runs on http://127.0.0.1:8787 by default)
npx wrangler dev --local
```

**Expected output:**
```
✅ Cloudflare Workers local development
→ Server ready at http://127.0.0.1:8787
```

Do NOT exit this terminal. Move to Terminal 2 for testing.

---

## Part 3: Run the Bill Scanner

### Terminal 2: Trigger the Scan

```bash
# Basic scan – should return JSON with scanned count and results
curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills \
  -H "Content-Type: application/json" | jq .

# Pretty-print the response
curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills 2>/dev/null | jq . > /tmp/scan_result.json
cat /tmp/scan_result.json
```

**Expected response shape:**
```json
{
  "scanned": 5,
  "results": [
    {
      "bill_id": "ocd-bill/us-wy:bill/2025/...",
      "bill_number": "HB 22",
      "topics": ["property-tax-relief"],
      "confidence_avg": "0.92"
    },
    {
      "bill_id": "ocd-bill/us-wy:bill/2025/...",
      "bill_number": "HB 23",
      "topics": [],
      "confidence_avg": null
    }
  ],
  "timestamp": "2025-12-05T15:42:18.000Z"
}
```

---

## Part 4: Verify Database Results

### Check WY_DB for AI Tags

```bash
cd /home/anchor/projects/this-is-us/worker

# See all civic_item_ai_tags created by the scan
npx wrangler d1 execute WY_DB --local \
  --command "
    SELECT 
      ait.item_id,
      ci.bill_number,
      ait.topic_slug,
      ait.confidence,
      ait.trigger_snippet,
      ait.created_at
    FROM civic_item_ai_tags ait
    LEFT JOIN civic_items ci ON ait.item_id = ci.id
    ORDER BY ait.created_at DESC
    LIMIT 10;
  " --json | jq '.[0].results'

# Count tags by topic
npx wrangler d1 execute WY_DB --local \
  --command "
    SELECT topic_slug, COUNT(*) as count
    FROM civic_item_ai_tags
    GROUP BY topic_slug
    ORDER BY count DESC;
  " --json | jq '.[0].results'
```

**Expected output:**
- Rows with bill_number, topic_slug (one of: property-tax-relief, water-rights, etc.), confidence (0.0–1.0)
- trigger_snippet showing quoted/paraphrased bill text
- created_at timestamp from when scan ran

### Check EVENTS_DB for Hot Topic Links

```bash
cd /home/anchor/projects/this-is-us/worker

# See all links from hot_topic_civic_items
npx wrangler d1 execute EVENTS_DB --local \
  --command "
    SELECT 
      ht.slug,
      ht.title,
      COUNT(htci.civic_item_id) as linked_bills
    FROM hot_topics ht
    LEFT JOIN hot_topic_civic_items htci ON ht.id = htci.topic_id
    GROUP BY ht.id
    ORDER BY ht.priority ASC;
  " --json | jq '.[0].results'

# Details of which bills linked to a topic
npx wrangler d1 execute EVENTS_DB --local \
  --command "
    SELECT 
      ht.slug,
      ci.bill_number,
      ci.title,
      htci.created_at
    FROM hot_topics ht
    JOIN hot_topic_civic_items htci ON ht.id = htci.topic_id
    LEFT JOIN civic_items ci ON htci.civic_item_id = ci.id
    ORDER BY ht.priority, htci.created_at DESC;
  " --json | jq '.[0].results'
```

**Expected output:**
- All 6 hot topics listed with linked_bills count > 0 (after scan runs)
- property-tax-relief, water-rights, education-funding, energy-permitting, public-safety-fentanyl, housing-land-use
- Each topic shows bill_number and title

---

## Part 5: Check Hot Topics Endpoint

### Verify GET /api/hot-topics includes new links

```bash
# Fetch all hot topics with linked bills
curl -s http://127.0.0.1:8787/api/hot-topics | jq '.[] | {slug, title, civic_items}'

# Fetch a specific topic (e.g., property-tax-relief)
curl -s http://127.0.0.1:8787/api/hot-topics/property-tax-relief | jq '.'
```

**Expected output:**
- Each topic has `civic_items` array populated (after scan)
- civic_items include bill_number, title, status, last_action_date
- Voting stats (up_votes, down_votes, info_votes)

---

## Part 6: Run Automated Integration Test

```bash
cd /home/anchor/projects/this-is-us

# Run the test helper script (see below for contents)
node test/test-bill-scanner.js

# Or with verbose logging
DEBUG=* node test/test-bill-scanner.js
```

---

## Edge Cases & Failure Modes

### 1. Missing OPENAI_API_KEY

**Symptom:** Scan runs but returns empty topics on all bills.

**Log output:** `⚠️ Missing OPENAI_API_KEY; cannot analyze bills`

**Fix:**
```bash
# In worker/ directory, check wrangler.toml or .env
echo "OPENAI_API_KEY=$OPENAI_API_KEY"

# If not set, add to terminal before starting wrangler dev
export OPENAI_API_KEY="sk-..."
npx wrangler dev --local
```

### 2. BILL_SCANNER_ENABLED Not Set

**Symptom:** POST returns `{"error": "Scanner disabled"}` with 403 status.

**Fix:**
```bash
export BILL_SCANNER_ENABLED=true
npx wrangler dev --local
```

### 3. No Pending Bills Available

**Symptom:** Scan runs instantly with scanned: 0, results: [].

**Verify:**
```bash
npx wrangler d1 execute WY_DB --local \
  --command "SELECT COUNT(*) FROM civic_items WHERE status IN ('introduced', 'in_committee', 'pending_vote');"
```

**Fix:** Import bills via OpenStates sync:
```bash
curl http://127.0.0.1:8787/api/dev/openstates/sync?session=2025&limit=20
```

### 4. OpenAI JSON Parse Failure

**Symptom:** Log shows `⚠️ Failed to parse AI JSON for bill ...` and topics: [].

**Root cause:** OpenAI returned malformed JSON or the model hallucinated a response.

**Expected handling:** Function returns { topics: [], other_flags: [] } gracefully. Bill is still saved (with no topics).

**Mitigation:** Check logs for raw AI response:
```bash
# In wrangler dev logs, look for:
# ⚠️ Failed to parse AI JSON for bill ocd-bill/...:
# [raw OpenAI response shown]
```

### 5. Host Check Rejection

**Symptom:** POST returns `{"error": "Forbidden. Dev access only."}` with 403 status.

**Cause:** Attempting to call scan endpoint from a different hostname (not 127.0.0.1 or localhost).

**Fix:** Ensure curl is hitting `http://127.0.0.1:8787/api/internal/civic/scan-pending-bills`, not `http://hostname:8787/...`.

### 6. Cross-Database Link Failure

**Symptom:** civic_item_ai_tags populated but hot_topic_civic_items empty.

**Log output:** `⚠️ Failed to fetch hot_topics from EVENTS_DB:` or `⚠️ Failed to link bill ... to topic ...`

**Cause:** EVENTS_DB not available or hot_topics table missing.

**Fix:**
```bash
# Verify EVENTS_DB migrations applied
npx wrangler d1 execute EVENTS_DB --local \
  --command "SELECT COUNT(*) FROM hot_topics WHERE is_active = 1;"
```

### 7. Duplicate Tags on Re-scan

**Symptom:** Running scan twice inserts duplicate rows.

**Expected behavior:** Scan clears prior tags with `DELETE FROM civic_item_ai_tags WHERE item_id = ?` before inserting new ones.

**Verify:** Run scan twice and check count hasn't doubled:
```bash
npx wrangler d1 execute WY_DB --local \
  --command "SELECT bill_number, COUNT(*) as dup_count FROM civic_item_ai_tags GROUP BY item_id HAVING COUNT(*) > 1;" --json
```

Should return no rows (no duplicates).

---

## Troubleshooting Checklist

| Issue | Check | Fix |
|-------|-------|-----|
| 403 Scanner disabled | `BILL_SCANNER_ENABLED=true` | Set env var before `npx wrangler dev` |
| 403 Forbidden (host) | curl uses 127.0.0.1 | Replace localhost with 127.0.0.1 |
| Empty results | OPENAI_API_KEY set | Export key before starting wrangler |
| topics: [] on all bills | OpenAI model working | Check logs for JSON parse errors |
| civic_item_ai_tags empty | WY_DB writable | Run migration 0009 |
| hot_topic_civic_items empty | EVENTS_DB writable | Run migrations 0001–0003 |
| No pending bills | civic_items has data | Run OpenStates sync (see Part 3) |
| Duplicate tags | Clear before insert | Expected behavior; scan again if needed |

---

## Success Criteria

✅ Scan endpoint returns 200 with scanned > 0  
✅ WY_DB.civic_item_ai_tags has rows matching scanned bills  
✅ EVENTS_DB.hot_topic_civic_items has rows linking bills to topics  
✅ GET /api/hot-topics shows updated civic_items arrays  
✅ All 6 hot topic slugs appear in at least one result  
✅ Confidence scores are between 0.0 and 1.0  
✅ trigger_snippets are non-empty for matched topics  
✅ No errors in wrangler dev console logs  
✅ Re-running scan does not create duplicate tags  

---

## Logs to Watch in wrangler dev Console

**Successful scan:**
```
🚀 Starting pending bill scan...
📋 Found 5 pending bills to scan
📄 Analyzing HB 22: Property Tax Relief Act
   → Found 1 hot topics
📄 Analyzing HB 23: Education Reform Bill
   → Found 2 hot topics
...
✅ Scan complete: 5 bills processed
```

**With errors:**
```
❌ Error processing bill HB 22: JSON parse failure
❌ handleScanPendingBills error: Cannot read property 'results'
⚠️ Missing OPENAI_API_KEY; cannot analyze bills
⚠️ Failed to fetch hot_topics from EVENTS_DB: (error details)
```

---

## Quick Reference Commands

```bash
# Kill any running wrangler dev processes
pkill -f "wrangler dev" || true

# Start fresh
cd /home/anchor/projects/this-is-us/worker
export OPENAI_API_KEY="sk-..."
export BILL_SCANNER_ENABLED=true
npx wrangler dev --local

# In another terminal, run full test suite
node /home/anchor/projects/this-is-us/test/test-bill-scanner.js

# Inspect results
npx wrangler d1 execute WY_DB --local \
  --command "SELECT COUNT(*) FROM civic_item_ai_tags;" --json | jq '.[0].results[0]'

npx wrangler d1 execute EVENTS_DB --local \
  --command "SELECT COUNT(*) FROM hot_topic_civic_items;" --json | jq '.[0].results[0]'
```

---

**Last Updated:** December 5, 2025
