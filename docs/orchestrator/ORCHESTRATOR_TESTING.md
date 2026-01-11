# Wyoming LSO Orchestrator Testing Guide

**File:** `ORCHESTRATOR_TESTING.md`  
**Date:** December 16, 2025  
**Scope:** Local testing of `/api/internal/admin/wyoleg/run` endpoint  

---

## Quick Start

The Wyoming LSO ingestion orchestrator is a single endpoint that runs the entire pipeline end-to-end:

```
POST /api/internal/admin/wyoleg/run
```

### 1. Start Local Dev Environment

```bash
cd /home/anchor/projects/this-is-us
./start_local.sh
```

This runs:
- Hugo on `http://127.0.0.1:1313`
- Wrangler on `http://127.0.0.1:8787`
- Persist dir: `./worker/../scripts/wr-persist`

### 2. Apply Migrations (First Time Only)

```bash
cd worker
./scripts/apply-migrations-local.sh
```

This creates:
- `ingestion_runs` - Logs each orchestrator run
- `ingestion_run_items` - Logs each bill processed in a run

### 3. Run Test Suite

```bash
cd worker
./scripts/test-wyoleg-orchestrator-local.sh
```

This performs:
- **Pre-check:** Verify D1 tables exist and have initial data
- **Orchestrator call:** POST to `/api/internal/admin/wyoleg/run`
- **Post-check:** Verify row counts increased
- **Sanity checks:** Hot topic distribution, doc resolution, summaries
- **API smoke tests:** `/api/hot-topics` and `/api/civic/pending-bills-with-topics`
- **Diagnostics:** If data missing, provide SQL commands to investigate

---

## Orchestrator Endpoint Details

### Request

```bash
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: local-dev" \
  --data '{
    "limit": 25,
    "force": true,
    "billId": null,
    "dryRun": false,
    "session": "2025"
  }'
```

### Query/Body Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 25 | Max bills to process per phase |
| `force` | boolean | false | Bypass TTL caches; re-scan all |
| `billId` | string | null | Run only single bill (e.g., "ocd-bill/...") |
| `dryRun` | boolean | false | Show what would happen without writing |
| `session` | string | current year | Legislative session (e.g., "2025", "2026") |

### Response (Success)

```json
{
  "run_id": "run-1702771200000-a1b2c3d4",
  "started_at": "2025-12-16T15:20:00.000Z",
  "finished_at": "2025-12-16T15:21:30.000Z",
  "synced_count": 12,
  "scanned_count": 12,
  "resolved_docs_count": 10,
  "summaries_written": 12,
  "tags_written": 15,
  "errors": []
}
```

### Response (Partial Error)

```json
{
  "run_id": "run-1702771200000-a1b2c3d4",
  "started_at": "2025-12-16T15:20:00.000Z",
  "finished_at": "2025-12-16T15:21:30.000Z",
  "synced_count": 12,
  "scanned_count": 10,
  "resolved_docs_count": 8,
  "summaries_written": 10,
  "tags_written": 12,
  "errors": [
    "scan: OpenAI API rate limit exceeded"
  ]
}
```

**Status Code:** 
- `200` - All phases succeeded
- `207` - Multi-status (some phases succeeded, some failed)
- `401` - Unauthorized (invalid or missing token)
- `403` - Scanner disabled (BILL_SCANNER_ENABLED != true)
- `500` - Critical error

---

## Pipeline Stages (What the Orchestrator Does)

### 1. Bill Sync (OpenStates Integration)

```
syncWyomingBills(env, WY_DB, { session, limit })
```

**What it does:**
- Queries Wyoming LSO API via OpenStates
- Fetches pending bills (introduced, in_committee, pending_vote)
- Inserts/updates `civic_items`, `bill_sponsors`, `civic_item_verification`

**Metrics:**
- `synced_count` - Bills fetched from OpenStates and inserted

**Skipped if:**
- `dryRun=true`
- Bill sync already happened recently (cache)

**Example logs:**
```
🚀 Starting bill sync: session=2025, limit=25
📥 Fetched 12 bills from OpenStates
📝 Inserted/updated 12 rows in civic_items
✅ Bill sync complete: synced_count=12
```

---

### 2. Document Resolution (Wyoleg PDF Finder)

**What it does:**
- For each bill, locates the best PDF from wyoleg.gov
- Tries multiple templates: Introduced, Enroll, Digest, Fiscal, Amendment
- Caches result in `civic_item_sources` table

**Metrics:**
- `resolved_docs_count` - URLs successfully resolved

**Cache behavior:**
- `force=true` - Re-resolve all PDFs
- `force=false` - Use cached URLs (skip if recent)

**Example logs:**
```
📄 Processing HB 22: Property Tax Assessment Cap
   🔗 Resolving document (wyoleg, 2025, HB22)...
   ✅ Found PDF: Introduced (https://legsrv.wyoleg.gov/.../HB0022.pdf)
   → Document URL: introduced (https://legsrv.wyoleg.gov/...)
```

---

### 3. Summary Generation (OpenAI)

**What it does:**
- Reads bill text from resolved PDF
- Calls OpenAI to generate plain-language summary
- Stores in `civic_items.ai_summary` and `ai_key_points`

**Metrics:**
- `summaries_written` - New summaries generated

**Requires:**
- OpenAI API key in `OPENAI_API_KEY` env
- Bill `text_url` from document resolution

**Example logs:**
```
   → Summary: 450 chars, 3 key points
   (Cached from ai_summary_generated_at)
```

---

### 4. Hot Topic Tagging (Hot Topics Analyzer)

**What it does:**
- Analyzes bill summary against all hot topics
- Scores confidence (0.0-1.0) for each topic match
- Saves tags to `civic_item_ai_tags`

**Metrics:**
- `tags_written` - Topic tags inserted

**Example logs:**
```
   → Found 2 hot topics:
      - election-integrity (confidence: 0.85)
      - education-reform (confidence: 0.72)
```

---

## Local Testing Workflow

### Scenario A: Fresh Local Start

```bash
# 1. Clean state
cd worker && rm -rf ./../scripts/wr ./.config/../scripts/wr

# 2. Apply migrations
./scripts/apply-migrations-local.sh

# 3. Run test suite (dry-run mode first)
./scripts/test-wyoleg-orchestrator-local.sh --dry-run

# 4. Examine results and decide to run for real
./scripts/test-wyoleg-orchestrator-local.sh

# 5. Review ingestion_runs table
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT run_id, started_at, synced_count, scanned_count, tags_written FROM ingestion_runs ORDER BY started_at DESC LIMIT 5;" --json
```

### Scenario B: Skip DB Checks (API-Only Test)

```bash
# If D1 not available or you only want to test the endpoint:
./scripts/test-wyoleg-orchestrator-local.sh --api-only

# This skips all ./scripts/wr d1 execute calls; only tests curl endpoints
```

### Scenario C: Single Bill Debug

```bash
# Run orchestrator on ONE bill only
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: local-dev" \
  --data '{
    "billId": "ocd-bill/us-wy-h-h-0022-2025",
    "dryRun": false,
    "limit": 1
  }' | jq .
```

---

## Troubleshooting

### Issue: "Unauthorized" (401)

**Cause:** Missing or invalid token header.

**Fix:**
```bash
# Localhost accepts 'local-dev' without validation
curl -H "X-Internal-Token: local-dev" ...

# Remote requires actual token from env.INTERNAL_SCAN_TOKEN
export TOKEN="your-actual-token-from-env"
curl -H "X-Internal-Token: $TOKEN" https://production-domain.com/api/internal/admin/wyoleg/run
```

---

### Issue: "Scanner disabled" (403)

**Cause:** Environment variable `BILL_SCANNER_ENABLED` is not `"true"`.

**Fix:**

Check `worker/./scripts/wr.toml`:
```toml
[env.development]
vars = { BILL_SCANNER_ENABLED = "true" }
```

Or set locally:
```bash
export BILL_SCANNER_ENABLED=true
./start_local.sh
```

---

### Issue: Orchestrator Returns Empty `synced_count` and `scanned_count`

**Cause:** No pending bills in WY_DB or all are already tagged.

**Check:**
```bash
# Are there any pending bills?
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT bill_number, status FROM civic_items WHERE status IN ('introduced','in_committee','pending_vote') LIMIT 5;" --json

# If none, seed with sample data:
cd worker && ./scripts/test-wyoleg-pipeline-local.sh --reset
```

---

### Issue: Hot Topics API Still Returns 0 Bills

**Cause:** Tags inserted but not linked to topics, OR summaries missing.

**Check #1: Do tags exist?**
```bash
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT topic_slug, COUNT(*) FROM civic_item_ai_tags GROUP BY topic_slug;" --json
```

**Check #2: Do summaries exist?**
```bash
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT COUNT(*) FROM civic_items WHERE ai_summary IS NOT NULL AND ai_summary != '';" --json
```

**Check #3: Are topics defined?**
```bash
./scripts/wr d1 execute EVENTS_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT slug, label FROM hot_topics ORDER BY label;" --json
```

**Check #4: Are junction rows created?**
```bash
./scripts/wr d1 execute EVENTS_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT COUNT(*) FROM hot_topic_civic_items;" --json
```

**If junction is empty:** The `hotTopicsAnalyzer.mjs` may not be creating links. Check worker logs for errors.

---

### Issue: No OpenAI Results (Summaries Not Generated)

**Cause:** OpenAI API key missing, rate limited, or disabled.

**Check logs:**
```bash
# Tail worker logs while orchestrator runs
tail -f /tmp/./scripts/wr-dev.log | grep -i "openai\|summary"
```

**Fix:**
```bash
# Ensure OPENAI_API_KEY is set
export OPENAI_API_KEY="sk-..."
./start_local.sh
```

---

### Issue: Slow Performance (Timeouts)

**Cause:** Too many bills or slow network.

**Fix:** Use `limit` parameter:
```bash
# Process only 5 bills instead of 25
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: local-dev" \
  --data '{"limit": 5, "force": true}'
```

---

## Example: Full Test Run

```bash
# 1. Ensure dev is running
./start_local.sh &

# 2. Wait for ./scripts/wr to start
sleep 5

# 3. Run orchestrator test
cd worker && ./scripts/test-wyoleg-orchestrator-local.sh

# Sample output:
# ╔════════════════════════════════════════════════════════════════════╗
# ║          WYOMING LSO ORCHESTRATOR TEST SUITE (Local)               ║
# ╚════════════════════════════════════════════════════════════════════╝
#
# 🔧 Configuration:
#    Persist Dir: ./../scripts/wr-persist
#    API Base:    http://127.0.0.1:8787
#    Dry-Run:     false
#    API-Only:    false
#
# ┌─ PRE-CHECK: D1 Tables Exist ─────────────────────────────────┐
# Checking EVENTS_DB tables (hot_topics, hot_topic_civic_items)...
#    ✅ hot_topics found
#    ✅ hot_topic_civic_items found
#
# ┌─ ORCHESTRATOR TEST: Trigger Endpoint ────────────────────────┐
#
# Request: POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run
# Payload:
# {
#   "limit": 25,
#   "force": true,
#   "dryRun": false
# }
#
# Response:
# {
#   "run_id": "run-1702771500000-abc123def456",
#   "started_at": "2025-12-16T15:25:00.000Z",
#   "finished_at": "2025-12-16T15:25:45.000Z",
#   "synced_count": 12,
#   "scanned_count": 12,
#   "resolved_docs_count": 10,
#   "summaries_written": 12,
#   "tags_written": 18,
#   "errors": []
# }
#
# 📊 Run Summary:
#    Run ID:             run-1702771500000-abc123def456
#    Synced Bills:       12
#    Scanned Bills:      12
#    Resolved Docs:      10
#    Summaries Written:  12
#    Tags Written:       18
#    Errors:             0 items
#
# ┌─ SANITY CHECK 1: Hot Topic Tag Distribution ────────────────────┐
# ✅ Found 5 unique topic slugs:
#    election-integrity: 8 items
#    education-reform: 5 items
#    healthcare-policy: 3 items
#    energy-regulation: 2 items
#    tax-reform: 2 items
#
# ┌─ API SMOKE TEST 1: GET /api/hot-topics ──────────────────────────┐
# ✅ Returned 5 topics
#    election-integrity: Election Integrity
#    education-reform: Education Reform
#    healthcare-policy: Healthcare Policy
#    energy-regulation: Energy Regulation
#    tax-reform: Tax Reform
#
# ┌─ API SMOKE TEST 2: GET /api/civic/pending-bills-with-topics ────┐
# ✅ Returned 12 pending bills with topics
#    HB 22: Property Tax Assessment Cap
#    HB 23: Education Funding Reform
#    SF 10: Healthcare Expansion
#
# ┌─ TEST SUITE COMPLETE ────────────────────────────────────────────┐
#
# ✅ Orchestrator test complete.
```

---

## Verifying Hot Topics UI Population

After running the orchestrator, verify the hot topics UI can retrieve data:

### Check 1: Static Route Response

```bash
curl -s http://127.0.0.1:8787/api/hot-topics | jq '.[] | {slug, label, civic_items_count: (.civic_items | length)}'
```

**Expected:**
```json
{
  "slug": "election-integrity",
  "label": "Election Integrity",
  "civic_items_count": 8
}
```

### Check 2: Pending Bills Route

```bash
curl -s http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results[0] | {bill_number, title, topics}'
```

**Expected:**
```json
{
  "bill_number": "HB 22",
  "title": "Property Tax Assessment Cap",
  "topics": [
    {
      "slug": "tax-reform",
      "label": "Tax Reform",
      "confidence": 0.85
    }
  ]
}
```

### Check 3: Frontend Build

Static HTML/JS should load topics from:
- `static/js/civic/hot-topics.js` - Renders UI
- `static/js/civic/pending-bills.js` - Renders bills with topics

Verify by opening browser developer console:
```javascript
// In browser console
fetch('http://127.0.0.1:8787/api/hot-topics').then(r => r.json()).then(d => console.log(d))
```

---

## Next Steps

1. **Run the test script:** `./scripts/test-wyoleg-orchestrator-local.sh`
2. **Review results:** Check for ✅ marks and diagnose any ⚠️ or ❌
3. **Commit to git:** Once all tests pass:
   ```bash
   git add worker/scripts/test-wyoleg-orchestrator-local.sh ORCHESTRATOR_TESTING.md
   git commit -m "docs: Add orchestrator testing guide and script"
   ```
4. **Deploy:** Run in production after code review
5. **Monitor:** Check `ingestion_runs` table for error trends

---

## Reference: Schema

### `ingestion_runs`

| Column | Type | Description |
|--------|------|-------------|
| `run_id` | TEXT | Unique run identifier |
| `started_at` | TEXT | ISO 8601 timestamp |
| `finished_at` | TEXT | ISO 8601 timestamp |
| `session` | TEXT | Legislative session (e.g., "2025") |
| `limit_requested` | INTEGER | Requested bill limit |
| `force_flag` | INTEGER | 1 if force=true |
| `dry_run` | INTEGER | 1 if dryRun=true |
| `synced_count` | INTEGER | Bills synced from OpenStates |
| `scanned_count` | INTEGER | Bills scanned for topics |
| `resolved_docs_count` | INTEGER | PDFs resolved |
| `summaries_written` | INTEGER | Summaries generated |
| `tags_written` | INTEGER | Topic tags inserted |
| `status` | TEXT | "ok", "partial", "error" |
| `error` | TEXT | Error message (if any) |

### `ingestion_run_items`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-increment |
| `run_id` | TEXT | FK to `ingestion_runs` |
| `civic_item_id` | TEXT | Bill ID |
| `bill_number` | TEXT | Bill number (e.g., "HB 22") |
| `phase` | TEXT | "sync", "resolve", "scan", etc. |
| `status` | TEXT | "ok" or "error" |
| `message` | TEXT | Error details |
| `duration_ms` | INTEGER | Phase duration |
| `created_at` | TEXT | Timestamp |

---

## See Also

- `STATUS_INGESTION_WYOLEG_SNAPSHOT.md` - Comprehensive pipeline overview
- `SNAPSHOT_VALIDATION_REPORT.txt` - Latest validation results
- `worker/src/routes/adminWyoleg.mjs` - Orchestrator handler
- `worker/src/routes/civicScan.mjs` - Scan logic
- `worker/src/lib/openStatesSync.mjs` - Bill sync logic
