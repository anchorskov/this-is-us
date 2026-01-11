# Local Test Harness - Quick Reference & Commands

## ✅ What Was Created

Three production-ready local testing scripts + comprehensive guide:

```
worker/scripts/verify-hot-topics-state.sh        (7.9 KB, executable)
worker/scripts/reset-civic-local.sh              (4.9 KB, executable)
worker/scripts/run-civic-pipeline-local.sh       (9.6 KB, executable)
worker/scripts/test-pipeline-integration.sh      (8.0 KB, executable) [demo]
worker/LOCAL_TEST_HARNESS_GUIDE.md              (Complete guide)
```

## 🎯 Key Findings: Proper Logical Order

**THE PROBLEM IDENTIFIED & SOLVED:**

Initial test order was: Seed → Verify (WRONG!)
- ❌ We tried to seed data BEFORE applying migrations
- ❌ Database schema didn't exist yet
- ❌ Tables were missing (civic_items, civic_item_ai_tags, etc.)

**THE CORRECT ORDER:**

```
1. Apply Migrations (creates schema)
   └─ ./scripts/wr d1 migrations apply WY_DB --local
   └─ ./scripts/wr d1 migrations apply EVENTS_DB --local

2. Seed Test Data (populates civic_items)
   └─ bash seed-test-bills.sh

3. Run Pipeline (resolve documents, scan for topics)
   └─ bash run-civic-pipeline-local.sh --seed --scan

4. Verify Results (check health metrics)
   └─ bash verify-hot-topics-state.sh

5. Test Reset (with backups)
   └─ bash reset-civic-local.sh --yes

6. Test Idempotency (run again, compare)
   └─ bash run-civic-pipeline-local.sh --scan
   └─ bash verify-hot-topics-state.sh (compare with step 4)
```

## 📋 Script Features Summary

### verify-hot-topics-state.sh
- **Read-only** health check
- Counts bills, sources, summaries, tags
- Shows topic distribution
- SF0013 spot check
- Graceful table detection
- **Safe to run anytime** ✅

### reset-civic-local.sh
- Requires `--yes` flag (safety)
- Backups to `backups/local_civic/<timestamp>/`
- Exports WY_DB + EVENTS_DB SQL
- Default: clear tags/sources/AI fields
- Options: `--full` (delete bills), `--clear-manual-links`
- **Recovery-safe** ✅

### run-civic-pipeline-local.sh
- Flag-based orchestration
- `--seed` (load test bills)
- `--resolve-only` (just document resolution)
- `--extract` (run PDF analyzer if available)
- `--scan` (generate topic tags)
- `--force` (bypass caching)
- `--stability-test` (run 3x, compare results)
- Always ends with verify
- **Fully repeatable** ✅

## 🚀 Quick Commands to Run

### Terminal 1: Start the worker
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr dev
# Output: Ready on http://localhost:8787
```

### Terminal 2: Run the pipeline

**Basic test:**
```bash
cd /home/anchor/projects/this-is-us/worker

# 1. Clean slate
./scripts/reset-civic-local.sh --yes

# 2. Run full pipeline
./scripts/run-civic-pipeline-local.sh --seed --scan

# 3. Check results
./scripts/verify-hot-topics-state.sh
```

**Stability test (3 runs):**
```bash
./scripts/reset-civic-local.sh --yes
./scripts/run-civic-pipeline-local.sh --seed --scan --stability-test
```

**Force refresh on 3rd run:**
```bash
./scripts/reset-civic-local.sh --yes
./scripts/run-civic-pipeline-local.sh --seed --scan --force --stability-test
```

**With PDF extraction (if script exists):**
```bash
./scripts/reset-civic-local.sh --yes
./scripts/run-civic-pipeline-local.sh --seed --scan --extract
```

**Just verify (no changes):**
```bash
./scripts/verify-hot-topics-state.sh
```

**Restore from backup:**
```bash
ls backups/local_civic/  # Find timestamp
BACKUP_TIME="<timestamp>"
./scripts/wr d1 execute WY_DB --local \
  --file=backups/local_civic/$BACKUP_TIME/WY_DB_$BACKUP_TIME.sql
```

## 📊 Expected Output Flow

### Step 1: verify-hot-topics-state.sh
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Hot Topics Pipeline Health Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 WY_DB Metrics:
  • Bills in civic_items: 5
  • Sources (total): 5 | Resolved: 0
  • Bills with summary (>40 chars): 0
  • Total topic tags: 0

📚 EVENTS_DB Metrics:
  • Hot topics defined: 12

🎯 SF0013 Spot Check:
  (data shown after pipeline runs)
```

### Step 2: reset-civic-local.sh --yes
```
╔══════════════════════════════════════════════════════════════════╗
║  🗑️  Local Civic Reset                                           ║
╚══════════════════════════════════════════════════════════════════╝

📦 Creating backup in: backups/local_civic/20251215_162530
  → Exporting WY_DB...
  ✓ Exported to backups/local_civic/20251215_162530/WY_DB_20251215_162530.sql
  → Exporting EVENTS_DB...
  ✓ Exported to backups/local_civic/20251215_162530/EVENTS_DB_20251215_162530.sql

🧹 Clearing derived data:
  → Deleting rows from civic_item_ai_tags...
  ✓ Cleared civic_item_ai_tags
  → Deleting rows from civic_item_sources...
  ✓ Cleared civic_item_sources
  → Resetting AI fields in civic_items...
  ✓ Reset AI fields

✅ Reset complete!
```

### Step 3: run-civic-pipeline-local.sh --seed --scan
```
╔══════════════════════════════════════════════════════════════════╗
║  🚀 Civic Ingestion + Hot Topics Pipeline                        ║
╚══════════════════════════════════════════════════════════════════╝

[STEP 1] Seed Test Bills
  → Running seed script
  ✓ Seed complete

[STEP 2] Resolve Document URLs
  → Calling scan endpoint
  ✓ Resolution complete

[STEP 3] Scan for Topics
  → Calling scan endpoint
  ✓ Scan complete

[STEP 4] Verify Results
  📊 WY_DB Metrics:
    • Bills in civic_items: 5
    • Total topic tags: 8
  🎯 SF0013: 1 tag (topic_slug: 0.92 confidence)
```

### Step 4: run-civic-pipeline-local.sh --scan --stability-test
```
╔══════════════════════════════════════════════════════════════════╗
║  🔄 Stability Test: Running Pipeline 3x                          ║
╚══════════════════════════════════════════════════════════════════╝

Run 1: Normal scan
  [metrics shown]

Run 2: Normal scan (repeat)
  [same metrics, proving idempotency]

Run 3: Scan with --force
  [same metrics, proving force is also idempotent]

✅ Stability test complete
💡 Compare the three verify outputs above to confirm:
   - Bill counts remain stable
   - Topic tag counts are idempotent
   - No data corruption on re-run
```

## 🔧 Troubleshooting

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| "Worker not running" | Can't reach http://127.0.0.1:8787 | Run `./scripts/wr dev` in Terminal 1 |
| "Table missing" | verify shows all tables missing | Migrations didn't apply. Run: `./scripts/wr d1 migrations apply WY_DB --local` |
| "0 bills after seed" | seed-test-bills.sh ran but no data | Check if migrations applied before seed |
| "Reset failed" | `--yes` flag missing | Always use: `reset-civic-local.sh --yes` |
| "No backup created" | Reset ran but backup folder empty | Check ../scripts/wr permissions and disk space |
| "Endpoint error" | Scan endpoint returns 500 | Check worker logs: `./scripts/wr tail WY_DB` |

## 📚 Related Files in Repo

- **Seed script**: `worker/seed-test-bills.sh` - Creates 5 test Wyoming bills
- **Extract script**: `worker/scripts/extract_pdf_text_and_analyze.py` - Optional PDF→AI pipeline
- **Migrations**: `worker/migrations_wy/*.sql` - Database schema
- **Worker code**: `worker/src/index.mjs` - Defines `/api/internal/civic/scan-pending-bills` endpoint
- **Guide**: `worker/LOCAL_TEST_HARNESS_GUIDE.md` - Complete reference

## ✨ Summary

**The proper logical order is now documented and proven:**

1. ✅ Schema → migrations applied first
2. ✅ Data → seed test bills into populated schema
3. ✅ Pipeline → resolve documents, generate tags
4. ✅ Verify → check health metrics (read-only)
5. ✅ Reset → safe reset with backups
6. ✅ Idempotency → run again, compare results

**All scripts are:**
- ✅ WSL-friendly
- ✅ Using `set -euo pipefail`
- ✅ Color-coded output
- ✅ Safety-first (require `--yes`, create backups)
- ✅ Graceful error handling
- ✅ Properly sequenced

**Ready to use:**
```bash
./scripts/reset-civic-local.sh --yes
./scripts/run-civic-pipeline-local.sh --seed --scan --stability-test
./scripts/verify-hot-topics-state.sh
```
