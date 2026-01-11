# How to Run Wyoming LSO Orchestrator Locally

**Quick Reference:** Run end-to-end ingestion pipeline via single POST endpoint.

---

## 60-Second Setup

### Terminal 1: Start Dev Environment

```bash
cd /home/anchor/projects/this-is-us
./start_local.sh
```

Runs Hugo (http://127.0.0.1:1313) and Wrangler (http://127.0.0.1:8787).  
Wait for "⚡ Ready on http://127.0.0.1:8787" message.

### Terminal 2: Run Orchestrator Test

```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/test-wyoleg-orchestrator-local.sh
```

This will:
1. ✅ Verify D1 tables exist
2. ✅ Call orchestrator endpoint
3. ✅ Check results (row counts, API responses)
4. ✅ Display summary with metrics
5. ✅ If anything fails, show diagnostic SQL

---

## Manual Testing (Minimal Setup)

If you just want to call the endpoint directly:

```bash
# 1. Ensure ./scripts/wr is running (see above)

# 2. Call orchestrator (test with force=true to force rescan)
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: local-dev" \
  --data '{"limit": 25, "force": true, "dryRun": false}' | jq .

# 3. Check hot topics API
curl -s http://127.0.0.1:8787/api/hot-topics | jq 'length'

# 4. Check pending bills with topics
curl -s http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results | length'
```

Expected response:
```json
{
  "run_id": "run-1702771200000-abc123",
  "started_at": "2025-12-16T15:20:00.000Z",
  "finished_at": "2025-12-16T15:21:30.000Z",
  "synced_count": 12,
  "scanned_count": 12,
  "resolved_docs_count": 10,
  "summaries_written": 12,
  "tags_written": 18,
  "errors": []
}
```

---

## One-Time Setup (First Run Only)

```bash
cd /home/anchor/projects/this-is-us/worker

# Apply D1 migrations (creates ingestion_runs table)
./scripts/apply-migrations-local.sh

# Verify tables exist
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('ingestion_runs','ingestion_run_items');" --json
```

Expected: Both tables exist.

---

## What the Orchestrator Does (Pipeline)

When you call `POST /api/internal/admin/wyoleg/run`, it runs 4 phases in sequence:

### Phase 1: Bill Sync
Fetches pending Wyoming bills from OpenStates API.  
Result: `synced_count` bills inserted into `civic_items` table.

### Phase 2: Document Resolution
For each bill, finds the PDF from wyoleg.gov.  
Result: `resolved_docs_count` URLs cached in `civic_item_sources`.

### Phase 3: Summary Generation
Uses OpenAI to generate plain-language summaries.  
Result: `summaries_written` rows updated in `civic_items.ai_summary`.

### Phase 4: Hot Topic Tagging
Analyzes summaries for matches with hot topics.  
Result: `tags_written` tags inserted into `civic_item_ai_tags`.

---

## Testing the UI

After running the orchestrator:

### 1. Check Hot Topics API

```bash
curl -s http://127.0.0.1:8787/api/hot-topics | jq .
```

Should return topics with civic_items populated:
```json
[
  {
    "id": "topic-1",
    "slug": "election-integrity",
    "label": "Election Integrity",
    "description": "...",
    "civic_items": [
      {
        "bill_id": "ocd-bill/...",
        "bill_number": "HB 22",
        "title": "Property Tax Cap",
        "confidence": 0.85
      }
    ]
  }
]
```

### 2. Check Pending Bills API

```bash
curl -s http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results[0]'
```

Should return bills with topics:
```json
{
  "id": "ocd-bill/...",
  "bill_number": "HB 22",
  "title": "Property Tax Assessment Cap",
  "summary": "...",
  "ai_summary": "Plain language summary...",
  "topics": [
    {
      "slug": "tax-reform",
      "label": "Tax Reform",
      "confidence": 0.85
    }
  ]
}
```

### 3. View in Browser

Open http://127.0.0.1:1313/civic/hot-topics/ to see the hot topics UI.

---

## Query Parameters Reference

```bash
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "X-Internal-Token: local-dev" \
  --data '{
    "limit": 25,           # Max bills to process (default 25)
    "force": true,         # Re-scan all (default false, uses cache)
    "dryRun": false,       # No writes (default false)
    "billId": null,        # Single bill ID to process (optional)
    "session": "2025"      # Legislative year (default current year)
  }' | jq .
```

---

## Troubleshooting

### "Unauthorized" Error

Add token header (localhost doesn't validate it):
```bash
-H "X-Internal-Token: local-dev"
```

### "Scanner disabled" Error

Set env before starting dev:
```bash
export BILL_SCANNER_ENABLED=true
./start_local.sh
```

### No Bills Synced/Scanned

Seed bills with:
```bash
cd worker && ./scripts/test-wyoleg-pipeline-local.sh --reset
```

### Hot Topics API Returns Empty

Run diagnostic:
```bash
# Check if topics exist
./scripts/wr d1 execute EVENTS_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT COUNT(*) FROM hot_topics;" --json

# Check if tags exist  
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT COUNT(*) FROM civic_item_ai_tags;" --json
```

See `ORCHESTRATOR_TESTING.md` for full troubleshooting.

---

## Full Test Script

For comprehensive testing with pre-checks, post-checks, and diagnostics:

```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/test-wyoleg-orchestrator-local.sh

# Options:
./scripts/test-wyoleg-orchestrator-local.sh --dry-run    # Dry-run mode
./scripts/test-wyoleg-orchestrator-local.sh --api-only   # Skip DB checks
```

This script will:
- ✅ Verify tables exist
- ✅ Show initial row counts
- ✅ Call orchestrator
- ✅ Show updated row counts
- ✅ Check hot-topics and pending-bills APIs
- ✅ If anything fails, run diagnostic SQL
- ✅ Display formatted summary

---

## Database Tables (Logging)

Orchestrator creates a run log in `ingestion_runs`:

```bash
# View run history
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT run_id, started_at, synced_count, scanned_count, tags_written, status 
   FROM ingestion_runs 
   ORDER BY started_at DESC 
   LIMIT 5;" --json
```

Each run also logs individual bills in `ingestion_run_items`:

```bash
# View bill details from latest run
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT iri.bill_number, iri.phase, iri.status, iri.message 
   FROM ingestion_run_items iri 
   JOIN (SELECT MAX(run_id) as latest FROM ingestion_runs) latest ON iri.run_id = latest.latest
   LIMIT 10;" --json
```

---

## Persist Directory

All local D1 data stored in:
```
/home/anchor/projects/this-is-us/worker/../scripts/wr-persist/
```

To reset local state:
```bash
cd worker && rm -rf ../scripts/wr-persist && mkdir -p ../scripts/wr-persist
./scripts/apply-migrations-local.sh
./scripts/test-wyoleg-pipeline-local.sh --reset
```

---

## See Also

- `ORCHESTRATOR_TESTING.md` - Comprehensive testing guide
- `ORCHESTRATOR_COPILOT_PROMPT.md` - Paste into Copilot for additional test generation
- `ORCHESTRATOR_IMPLEMENTATION_SUMMARY.md` - Architecture overview
- `STATUS_INGESTION_WYOLEG_SNAPSHOT.md` - Pipeline documentation

---

## Quick Commands Cheat Sheet

```bash
# Start dev (both Hugo + Wrangler)
./start_local.sh

# Run full test suite
cd worker && ./scripts/test-wyoleg-orchestrator-local.sh

# Call orchestrator (manual)
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "X-Internal-Token: local-dev" \
  --data '{"limit": 25, "force": true}' | jq .

# Check hot topics API
curl -s http://127.0.0.1:8787/api/hot-topics | jq 'length'

# Check pending bills API
curl -s http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results | length'

# View run history
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT run_id, synced_count, scanned_count, tags_written FROM ingestion_runs ORDER BY started_at DESC LIMIT 5;" --json

# Seed bills (if empty)
./scripts/test-wyoleg-pipeline-local.sh --reset
```

