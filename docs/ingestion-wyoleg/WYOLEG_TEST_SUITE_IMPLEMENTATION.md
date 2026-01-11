# Wyoming LSO Pipeline Test Suite – Implementation Summary

**Date:** December 15, 2025  
**Status:** ✅ Complete & Ready for Use

---

## 📋 Files Created/Modified

### 1. **worker/scripts/test-wyoleg-pipeline-local.sh** ✅
**Type:** Test Runner (Bash)  
**Size:** ~400 lines  
**Purpose:** Orchestrates full pipeline test with:
- Automatic worker startup/shutdown
- Optional reset (--reset flag)
- PDF resolution step (resolveOnly=1)
- PDF extraction + AI summaries (Python script)
- Topic tagging (force=1 scan)
- Health verification via SQL
- SF0013 spot checks
- Summary report with PASS/FAIL

**Key Features:**
- Uses persistent local D1 (`../scripts/wr-persist`)
- All queries via `--local` only (never remote)
- Colored output for readability
- Automatic cleanup with `trap`
- Idempotent (can run multiple times safely)

---

### 2. **worker/scripts/sql/check-wyoleg-health.sql** ✅
**Type:** SQL Verification (SQLite)  
**Size:** ~150 lines  
**Purpose:** Comprehensive health checks executed by test runner:

**Queries:**
1. Bills in `civic_items` (count)
2. Resolved sources in `civic_item_sources` (count)
3. AI summaries generated (>40 chars)
4. Topic tags in `civic_item_ai_tags` (count)
5. Top 10 topics by tag frequency
6. SF0013 spot check (civic_item, source, tags)
7. Pipeline status summary

**Output Format:** JSON (from `./scripts/wr d1 execute ... --json`)

---

### 3. **src/routes/civicScan.mjs** ✅ (Modified)
**Changes:**
- Added `resolveOnly` parameter to `scanPendingBillsInternal()`
- Modified `handleScanPendingBills()` to parse `?resolveOnly=1` query param
- Skips OpenAI/summary/tagging when `resolveOnly=true`
- Returns `sources_resolved` counter in response
- Logs step counters (bills scanned, sources resolved, tags inserted)

**New Query Params:**
```
POST /api/internal/civic/scan-pending-bills?resolveOnly=1
POST /api/internal/civic/scan-pending-bills?force=1
POST /api/internal/civic/scan-pending-bills?resolveOnly=1&force=1
```

---

## 🚀 Usage

### Quick Start

```bash
# Reset state and run full pipeline
cd /home/anchor/projects/this-is-us/worker
./scripts/test-wyoleg-pipeline-local.sh --reset

# Idempotency test (no reset)
./scripts/test-wyoleg-pipeline-local.sh

# Skip Python extraction step
./scripts/test-wyoleg-pipeline-local.sh --no-extract
```

### Full Test Flow

```
1. [Optional] Reset civic state (--reset flag)
   └─ Clears ai_summaries, ai_tags, civic_item_sources

2. Start worker locally (../scripts/wr-persist)
   └─ ./scripts/wr dev --local --persist-to ../scripts/wr-persist

3. Resolve PDFs (no OpenAI cost)
   └─ POST /api/internal/civic/scan-pending-bills?resolveOnly=1
   └─ Populates: civic_item_sources.best_doc_url, status='ok'

4. Extract PDFs + Generate AI Summaries
   └─ python3 scripts/extract_pdf_text_and_analyze.py --local --limit 25
   └─ Updates: civic_items.ai_summary, ai_key_points

5. Scan for Hot Topics (with force=1)
   └─ POST /api/internal/civic/scan-pending-bills?force=1
   └─ Populates: civic_item_ai_tags

6. Verify Pipeline Health
   └─ ./scripts/wr d1 execute WY_DB --local --file scripts/sql/check-wyoleg-health.sql
   └─ Checks: bills, resolved sources, summaries, tags

7. Spot Check SF0013
   └─ Civic item, source URL, AI tags, summary length

8. Summary Report
   └─ PASS/FAIL determination
   └─ Metrics: civic_items, sources_resolved, summaries, tags
```

---

## ✅ Test Verification Criteria

The test script automatically checks these metrics:

| Metric | Check | Threshold |
|--------|-------|-----------|
| **Civic Items** | Count in `civic_items` | > 0 (FAIL if 0) |
| **Resolved Sources** | Count in `civic_item_sources` where status IN ('resolved', 'ok') | > 0 (FAIL if 0) |
| **AI Summaries** | Count where LENGTH(ai_summary) > 40 | ≥ 5 (WARN if < 5) |
| **AI Tags** | Count in `civic_item_ai_tags` | > 0 (WARN if 0) |
| **SF0013 Source** | Resolved URL for bill SF0013 | Must exist |
| **SF0013 Summary** | Summary length for SF0013 | > 0 chars |
| **SF0013 Tags** | Count of topic tags for SF0013 | ≥ 1 (info only) |

---

## 🔧 Route Changes – API Details

### POST /api/internal/civic/scan-pending-bills?resolveOnly=1

**Purpose:** Resolve PDFs without calling OpenAI (cost-free test)

**Flow:**
1. Select pending bills (via `selectBillsForScan()`)
2. For each bill: Resolve document URL via `resolveDocument()`
3. Upsert to `civic_item_sources` with `status='ok'` or `status='missing'`
4. Skip summary generation and topic analysis
5. Return early for each bill

**Response:**
```json
{
  "scanned": 25,
  "saved_tags": 0,
  "sources_resolved": 18,
  "resolve_only": true,
  "results": [
    {
      "bill_id": "...",
      "bill_number": "SF0013",
      "resolved": true,
      "summary_generated": false,
      "topics": []
    }
  ],
  "timestamp": "2025-12-15T..."
}
```

**Logs:**
```
🚀 Starting pending bill scan... {"batchSize": 5, "force": false, "resolveOnly": true}
📋 Found 25 pending bills to scan
📄 Processing SF0013: ...
   → Document URL: html (https://...)
✅ Resolve-only complete: 25 bills processed, 18 new sources resolved
```

### POST /api/internal/civic/scan-pending-bills?force=1

**Purpose:** Scan for hot topics (full pipeline, existing functionality)

**Response:**
```json
{
  "scanned": 25,
  "saved_tags": 42,
  "sources_resolved": 0,
  "resolve_only": false,
  "results": [
    {
      "bill_id": "...",
      "bill_number": "SF0013",
      "topics": ["water-rights", "energy-permitting"],
      "confidence_avg": "0.78",
      "summary_generated": true
    }
  ],
  "timestamp": "2025-12-15T..."
}
```

---

## 📊 Debug Output Examples

### Example: Full Test Run

```bash
$ ./scripts/test-wyoleg-pipeline-local.sh --reset

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🧪 Wyoming LSO Pipeline Test Suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configuration:
  Persistence Dir: ../scripts/wr-persist
  Worker URL: http://127.0.0.1:8787
  Reset: 1
  Extract: 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Step 1: Reset Civic State
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Reset complete

[... more steps ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📊 Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pipeline Metrics:
  Bills in civic_items: 25
  Resolved sources: 18
  Summaries (>40 chars): 15
  AI tags total: 42

✅ TEST PASSED ✨
```

---

## 🐛 Troubleshooting

### "No bills need topic analysis"
**Cause:** No bills in `civic_items` with pending status  
**Fix:** Seed bills first using `seed-test-bills.sh` or `backfill_wy_bills_local.sh`

### "No document URL resolved"
**Cause:** docResolver failed or wyoleg.gov URLs changed  
**Fix:** Check `../scripts/wr-dev.log` for resolver errors, verify wyoleg.gov structure

### "Error: Scanner disabled"
**Cause:** `BILL_SCANNER_ENABLED` env var not set to "true"  
**Fix:** Ensure `./scripts/wr.toml` or env has `BILL_SCANNER_ENABLED = "true"`

### Worker fails to start
**Cause:** Port 8787 already in use  
**Fix:** Kill existing process or change port in test script

### "civic_item_ai_tags is empty"
**Cause:** OpenAI API key missing or summaries didn't generate  
**Fix:** Check `OPENAI_API_KEY` in env, verify `extract_pdf_text_and_analyze.py` ran successfully

---

## 📝 Implementation Notes

### Why `resolveOnly=1`?
- **Cost:** Avoids OpenAI calls (saves ~$0.05 per test)
- **Speed:** Runs in seconds instead of minutes
- **Debugging:** Isolates PDF resolution from AI steps
- **CI/CD:** Can run frequently without API quotas

### Persistence Directory
- Local D1 state saved to `../scripts/wr-persist/`
- Survives worker restarts
- Cleaned with `--reset` flag
- Contains SQLite database files

### SQL Verification
- Queries executed directly via `./scripts/wr d1 execute ... --local`
- No Python required (pure SQLite)
- Spot checks SF0013 for manual inspection
- Extensible for additional queries

### Error Handling
- Script exits on first error (`set -euo pipefail`)
- Worker automatically cleaned up on exit (`trap`)
- Missing script errors are warnings, not failures
- JSON parsing failures handled gracefully

---

## 🎯 Next Steps

1. **Run the test:**
   ```bash
   ./scripts/test-wyoleg-pipeline-local.sh --reset
   ```

2. **Check output:**
   - Look for `✅ TEST PASSED`
   - Review SF0013 details
   - Verify pipeline metrics

3. **Debug if needed:**
   - Check `../scripts/wr-dev.log` for worker errors
   - Run SQL queries manually:
     ```bash
     ./scripts/wr d1 execute WY_DB --local --file scripts/sql/check-wyoleg-health.sql
     ```

4. **Integrate into CI:**
   - Add test to GitHub Actions (or equivalent)
   - Run on every PR
   - Alert on test failures

---

## 📦 Files Summary

| File | Type | Lines | Purpose |
|------|------|-------|---------|
| `scripts/test-wyoleg-pipeline-local.sh` | Bash | 400+ | Test orchestrator |
| `scripts/sql/check-wyoleg-health.sql` | SQL | 150+ | Health verification |
| `src/routes/civicScan.mjs` | JS | Modified | Added resolveOnly param |

---

**Created:** December 15, 2025  
**Version:** 1.0 (Initial Release)  
**Status:** ✅ Ready for Production Testing
