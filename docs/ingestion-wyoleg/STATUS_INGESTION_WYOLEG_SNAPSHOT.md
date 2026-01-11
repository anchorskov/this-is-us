# Wyoming LSO Ingestion Pipeline: Single Source of Truth

**Generated:** December 16, 2025, 14:30 UTC  
**Git Commit:** `c2dced5703be6f6f26ee9cbf5273c8bf9ac02258`  
**Canonical Persist Directory:** `worker/../scripts/wr-persist`  
**Snapshot Purpose:** Eliminate document drift and ensure consistency between docs, scripts, and runtime behavior.

---

## File Existence Verification

All required scripts confirmed to exist:

```
✅ docs/INGESTION_TODO_NEXT.md
✅ docs/STATUS_INGESTION_WYOLEG.md
✅ worker/scripts/apply-migrations-local.sh
✅ worker/scripts/audit-wyoleg-ingestion.sh
✅ worker/scripts/test-wyoleg-pipeline-local.sh
✅ worker/scripts/test-doc-resolver-local.sh
```

---

## Section 1: INGESTION_TODO_NEXT.md

# Wyoming LSO Ingestion: Next Actions

Ordered, high-impact tasks with validation commands.

1) Apply local migrations with persistence
   - `cd worker && ./scripts/apply-migrations-local.sh`
   - Validate: `XDG_CONFIG_HOME=./.config ./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command "SELECT name FROM d1_migrations;" --json`

2) Ensure single persist dir in dev runs
   - Start via `./start_local.sh` (uses --persist-to ./worker/../scripts/wr-persist).
   - Validate: `find worker/../scripts/wr-persist -name "*.sqlite"`

3) Run full wyoleg pipeline locally (fresh)
   - `cd worker && ./scripts/test-wyoleg-pipeline-local.sh --reset`
   - Validate: script reports summaries/tags > 0 and civic_item_sources populated.

4) Audit ingestion state
   - `cd worker && ./scripts/audit-wyoleg-ingestion.sh`
   - Validate: report shows required tables present and counts (bills, sources, summaries, tags).

5) Hot-topics linkage sanity
   - If needed, seed hot_topic_civic_items with current bills (manual/SQL).
   - Validate: `./scripts/wr d1 execute EVENTS_DB --local --persist-to ./../scripts/wr-persist --command "SELECT COUNT(*) FROM hot_topic_civic_items;" --json`

6) Remote schema parity check
   - `cd worker && XDG_CONFIG_HOME=./.config ./scripts/wr d1 migrations list WY_DB --remote`
   - Validate: compare against local `d1_migrations`; apply if missing.

7) Doc resolver spot check
   - `cd worker && BILL=SF0013 YEAR=2026 DEBUG=1 ./scripts/test-doc-resolver-local.sh`
   - Validate: output shows best URL ending in Introduced/Enroll/Digest/Fiscal PDF.

8) Pending-bills API smoke
   - With worker running: `curl -s http://127.0.0.1:8787/api/civic/pending-bills-with-topics | jq '.results | length'`
   - Validate: count > 0.

9) Hot-topics API smoke
   - `curl -s http://127.0.0.1:8787/api/hot-topics | jq 'length'`
   - Validate: length matches hot_topics count; no 500s.

10) Commit/update snapshot doc
    - Update `instructions/database_snapshot_12-14-25.md` with current counts and migrations once above passes.

---

## Section 2: STATUS_INGESTION_WYOLEG.md

# STATUS: Wyoming LSO (wyoleg.gov) Ingestion

Date: Generated locally (this-is-us repo)  
Scope: Local pipeline status (D1 local, worker dev)  

## Current State (Local)
- Source: Wyoming LSO (wyoleg.gov) pending bills (LSO/OpenStates upstream via worker).
- DB bindings: `WY_DB` (civic_items, civic_item_sources, civic_item_ai_tags, civic_item_verification, bill_sponsors); `EVENTS_DB` (hot_topics, hot_topic_civic_items).
- Local persistence: `./worker/../scripts/wr-persist`.
- Hot Topics migrations applied locally; tables exist with data (12 hot_topics, 0 junction rows).
- Resolver enabled: doc resolver resolves wyoleg PDFs (Introduced/Enroll/Digest/Fiscal, amendments) before AI analysis; writes to `civic_item_sources`.
- AI analysis: summaries + hot-topic tags via `scan-pending-bills` route; tags stored in `civic_item_ai_tags`.
- UI endpoints: `/api/civic/pending-bills-with-topics` and `/api/hot-topics` feed static JS (pending-bills.js, hot-topics.js).

## Pipeline Map (Sequence)
1) **Bill list ingestion**
   - File: `worker/src/lib/openStatesSync.mjs` (called by `runPendingBillsRefresh` in `worker/src/jobs/pendingBillsRefresh.mjs`).
   - Route/cron: `/api/dev/openstates/sync` (dev) and scheduled cron (see `./scripts/wr.toml` cron).
   - DB: `WY_DB.civic_items`, `bill_sponsors`, `civic_item_verification`.
   - Flags: `BILL_SCANNER_ENABLED` gates scan step; OpenStates/LSO creds via env.

2) **Document resolution (wyoleg PDFs)**
   - Files: `worker/src/lib/docResolver/index.mjs`, `.../profiles/wyoleg.mjs`.
   - Templates: `{year}/Introduced|Enroll|Digest|Fiscal/{bill}.pdf`; checkpoints `/Legislation/{year}/{bill}`, `/Legislation/Amendment/{year}?billNumber={bill}` with /Amends/*.pdf parsing; SPA shell detection.
   - Route: used inside `scan-pending-bills` (below).
   - DB: `WY_DB.civic_item_sources` (best_doc_url, kind, status, checked_at, last_error).

3) **Text/Summary + Hot Topics analysis**
   - Route: `POST /api/internal/civic/scan-pending-bills` (token-gated except localhost); cron triggers `runPendingBillsRefresh`.
   - File: `worker/src/routes/civicScan.mjs` (selection, doc resolve, summary, tagging).
   - AI summary: `worker/src/lib/billSummaryAnalyzer.mjs` → `civic_items.ai_summary`, `ai_key_points`.
   - Hot-topic tagging: `worker/src/lib/hotTopicsAnalyzer.mjs` → `civic_item_ai_tags`; links to `EVENTS_DB.hot_topic_civic_items`.
   - Flags: `BILL_SCANNER_ENABLED=true`; auth header `X-Internal-Token` for non-local.

4) **UI consumption**
   - Pending bills: `worker/src/routes/pendingBills.mjs` → `/api/civic/pending-bills-with-topics`; DB `WY_DB` + `EVENTS_DB`.
   - Hot topics list/detail: `worker/src/routes/hotTopics.mjs` → `/api/hot-topics`, `/api/hot-topics/:slug`; DB `EVENTS_DB`, `WY_DB`.
   - Frontend: `static/js/civic/pending-bills.js`, `static/js/civic/hot-topics.js`.

## Tables and Columns (Key)
- `WY_DB.civic_items`: bill metadata, AI summary fields (`ai_summary`, `ai_key_points`, `ai_summary_generated_at`).
- `WY_DB.civic_item_sources`: resolved doc provenance (`civic_item_id` PK, best_doc_url, best_doc_kind, status, checked_at, last_error).
- `WY_DB.civic_item_ai_tags`: hot-topic tags (`item_id`, `topic_slug`, `confidence`, `trigger_snippet`, `reason_summary`, unique item/topic).
- `WY_DB.civic_item_verification`: verification status for pending bills.
- `WY_DB.bill_sponsors`: sponsor data tied to civic_items.
- `EVENTS_DB.hot_topics`, `EVENTS_DB.hot_topic_civic_items`: canonical topics and manual links.
- `EVENTS_DB.podcast_uploads`: unrelated to wyoleg but present.

## Endpoints and Scripts
- Routes:
  - `POST /api/internal/civic/scan-pending-bills` (doc resolve + summary + tags).
  - `GET /api/civic/pending-bills-with-topics`.
  - `GET /api/hot-topics`, `GET /api/hot-topics/:slug`.
  - Dev: `/api/dev/openstates/sync`, `/api/internal/civic/test-one`.
- Cron: `./scripts/wr.toml` has weekly pending-bills refresh (`runPendingBillsRefresh` → sync + scan).
- Scripts:
  - `worker/scripts/apply-migrations-local.sh` (local migrations, persist).
  - `worker/scripts/test-wyoleg-pipeline-local.sh` (end-to-end local, persist).
  - `worker/scripts/test-doc-resolver-local.sh` (resolve SF0013).
  - `worker/scripts/audit-wyoleg-ingestion.sh` (audit entrypoints, counts, schema).
  - `worker/scripts/run-civic-pipeline-local.sh`, `reset-civic-local.sh`, `verify-hot-topics-state.sh`.

## Top 10 Failure Modes (and detection)
1) Missing hot_topics tables locally → `/api/hot-topics` 500. Detect: `./scripts/wr d1 execute EVENTS_DB --local ... SELECT name FROM sqlite_master WHERE name='hot_topics';`
2) No persistence/duplicate D1 → data drift. Detect: `find ../scripts/wr* -name "*.sqlite"`; ensure `--persist-to ./../scripts/wr-persist`.
3) Scanner disabled → no tags/summaries. Detect logs: “BILL_SCANNER_ENABLED != true”.
4) Missing token on scan endpoint → 401. Detect: response error JSON `Unauthorized`.
5) SPA shell doc fetch (no PDF) → civic_item_sources missing URL. Detect: query `best_doc_url IS NULL`.
6) AI summary absent → `pending-bills-with-topics` filter hides bills. Detect: `COUNT(*) WHERE ai_summary IS NULL OR ai_summary=''`.
7) No hot_topic_civic_items links → `/api/hot-topics` returns topics with empty civic_items. Detect: `COUNT(*) FROM hot_topic_civic_items`.
8) OpenAI env missing → summaries/tags fail. Detect logs from `billSummaryAnalyzer` / `hotTopicsAnalyzer`.
9) Migrations not applied remotely → schema errors. Detect: `d1_migrations` mismatch between local/remote.
10) Guardrails absent → wrong state dir. Detect: guardrail script warnings; fix config/persist flags.

## Single Source of Truth Recommendations
- Always run local worker with `--persist-to ./worker/../scripts/wr-persist` and `XDG_CONFIG_HOME=./worker/.config`.
- Apply migrations via `./scripts/apply-migrations-local.sh` before tests.
- Treat `WY_DB` as source for bills/tags/summaries; `EVENTS_DB` for topics/links. Do not duplicate hot_topics elsewhere.
- Run `./scripts/audit-wyoleg-ingestion.sh` before commits to capture schema and counts.

---

## Section 3: worker/scripts/apply-migrations-local.sh

```bash
#!/usr/bin/env bash
# worker/scripts/apply-migrations-local.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$(dirname "$SCRIPT_DIR")"
cd "$WORKER_DIR"

PERSIST_DIR="./../scripts/wr-persist"
mkdir -p "$PERSIST_DIR"

export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$WORKER_DIR/.config}"

echo "🔧 Applying local migrations with --persist-to ${PERSIST_DIR}"

for DB in EVENTS_DB WY_DB; do
  echo "➡️  ${DB}"
  ./scripts/wr d1 migrations apply "$DB" --local --persist-to "$PERSIST_DIR"
done

echo "✅ Local migrations applied"
```

---

## Section 4: worker/scripts/audit-wyoleg-ingestion.sh

```bash
#!/usr/bin/env bash
# worker/scripts/audit-wyoleg-ingestion.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_DIR="$(dirname "$SCRIPT_DIR")"
cd "$WORKER_DIR"

PERSIST_DIR="./../scripts/wr-persist"
export XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$WORKER_DIR/.config}"

echo "🔎 Audit: Wyoming LSO ingestion (local only)"
echo "Working dir: $WORKER_DIR"
echo "Persist dir: $PERSIST_DIR"
echo ""

report_header() {
  echo ""
  echo "=== $1 ==="
}

report_header "Entrypoints found"
rg --line-number --context 2 "scan-pending-bills|pending-bills-with-topics|hot-topics|wyoleg|LSO|Legislation/20|Amendment|SPA|civic_item_sources" worker static || true

report_header "D1 schema health"
for DB in EVENTS_DB WY_DB; do
  echo "-- $DB tables"
  ./scripts/wr d1 execute "$DB" --local --persist-to "$PERSIST_DIR" --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" --json
done

report_header "Required table counts"
./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT 'civic_items' t, COUNT(*) c FROM civic_items
UNION ALL SELECT 'civic_item_sources', COUNT(*) FROM civic_item_sources
UNION ALL SELECT 'civic_item_ai_tags', COUNT(*) FROM civic_item_ai_tags
UNION ALL SELECT 'civic_item_verification', COUNT(*) FROM civic_item_verification;
" --json
./scripts/wr d1 execute EVENTS_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT 'hot_topics' t, COUNT(*) c FROM hot_topics
UNION ALL SELECT 'hot_topic_civic_items', COUNT(*) FROM hot_topic_civic_items;
" --json

report_header "Pipeline state"
./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT 'bills_total' k, COUNT(*) v FROM civic_items
UNION ALL SELECT 'sources' , COUNT(*) FROM civic_item_sources
UNION ALL SELECT 'summaries', COUNT(*) FROM civic_items WHERE ai_summary IS NOT NULL AND ai_summary <> ''
UNION ALL SELECT 'tags', COUNT(*) FROM civic_item_ai_tags;
" --json
echo "Top topics:"
./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT topic_slug, COUNT(*) c FROM civic_item_ai_tags GROUP BY topic_slug ORDER BY c DESC LIMIT 10;
" --json

report_header "UI integration sanity"
rg --line-number "api/civic/pending-bills-with-topics|api/hot-topics" static/js/civic || true

echo ""
echo "Next commands:"
echo "  ./scripts/apply-migrations-local.sh"
echo "  ./scripts/test-wyoleg-pipeline-local.sh --reset"
echo "  ./scripts/audit-wyoleg-ingestion.sh"
```

---

## Path Consistency & Normalization

**Issue:** Docs mention both `./worker/../scripts/wr-persist` and `./../scripts/wr-persist` causing potential multiple D1 instances.

**Resolution:** Normalize to canonical path: **`worker/../scripts/wr-persist`**

**Updated guidance for all scripts and documentation:**
- Always run from **repo root** with persist path: `worker/../scripts/wr-persist`
- When running from `worker/` directory, use: `./../scripts/wr-persist`
- `start_local.sh` correctly uses: `"${WORKER_DIR}/../scripts/wr-persist"` (resolves to `worker/../scripts/wr-persist`)

**All new scripts must use:**
```bash
PERSIST_DIR="worker/../scripts/wr-persist"  # from repo root
# OR when in worker/ directory:
PERSIST_DIR="./../scripts/wr-persist"
```

---

## Snapshot Sanity Checks

### A) Table Existence Verification

Confirms all required tables exist in both databases.

```bash
cd ~/projects/this-is-us/worker
PERSIST_DIR="./../scripts/wr-persist"

echo "=== EVENTS_DB: required tables ==="
./scripts/wr d1 execute EVENTS_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT name
FROM sqlite_schema
WHERE type='table'
  AND name IN ('hot_topics','hot_topic_civic_items','votes')
ORDER BY name;
"

echo ""
echo "=== WY_DB: required tables ==="
./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT name
FROM sqlite_schema
WHERE type='table'
  AND name IN ('civic_items','civic_item_sources','civic_item_ai_tags')
ORDER BY name;
"
```

**Expected Output:**
```
EVENTS_DB tables: hot_topics, hot_topic_civic_items, votes
WY_DB tables: civic_items, civic_item_sources, civic_item_ai_tags
```

---

### B) Row Counts & Basic Health

Checks if tables have data (non-zero counts indicate successful ingestion).

```bash
cd ~/projects/this-is-us/worker
PERSIST_DIR="./../scripts/wr-persist"

echo "=== EVENTS_DB counts ==="
./scripts/wr d1 execute EVENTS_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT 'hot_topics' AS table_name, COUNT(*) AS n FROM hot_topics
UNION ALL
SELECT 'hot_topic_civic_items', COUNT(*) FROM hot_topic_civic_items
UNION ALL
SELECT 'votes', COUNT(*) FROM votes;
"

echo ""
echo "=== WY_DB counts ==="
./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT 'civic_items' AS table_name, COUNT(*) AS n FROM civic_items
UNION ALL
SELECT 'civic_item_sources', COUNT(*) FROM civic_item_sources
UNION ALL
SELECT 'civic_item_ai_tags', COUNT(*) FROM civic_item_ai_tags;
"
```

**Success Criteria:** All counts > 0

---

### C) Pipeline Signal Checks

Confirms the ingestion pipeline is actively processing bills.

```bash
cd ~/projects/this-is-us/worker
PERSIST_DIR="./../scripts/wr-persist"

echo "=== WY_DB pipeline signals ==="
./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT
  SUM(CASE WHEN COALESCE(ai_summary,'') <> '' THEN 1 ELSE 0 END) AS bills_with_ai_summary,
  SUM(CASE WHEN COALESCE(ai_key_points,'') <> '' AND ai_key_points <> '[]' THEN 1 ELSE 0 END) AS bills_with_key_points,
  COUNT(*) AS total_bills
FROM civic_items;
"

echo ""
echo "=== Sources resolution health (status distribution) ==="
./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT status, COUNT(*) AS n
FROM civic_item_sources
GROUP BY status
ORDER BY n DESC, status ASC;
"
```

**Success Criteria:** bills_with_ai_summary and bills_with_key_points > 0

---

### D) Hot Topic Tag Distribution

Confirms tags exist and are properly distributed.

```bash
cd ~/projects/this-is-us/worker
PERSIST_DIR="./../scripts/wr-persist"

echo "=== Hot topic tags distribution (top 20) ==="
./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT topic_slug, COUNT(*) AS n
FROM civic_item_ai_tags
GROUP BY topic_slug
ORDER BY n DESC, topic_slug ASC
LIMIT 20;
"
```

**Success Criteria:** Multiple topics with non-zero counts

---

### E) Canary Check: SF0013

Tests a known "hard case" bill to validate complete pipeline.

```bash
cd ~/projects/this-is-us/worker
PERSIST_DIR="./../scripts/wr-persist"

echo "=== SF0013: Summary + Sources + Tags ==="

echo "Summary:"
./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT
  id,
  bill_number,
  title,
  LENGTH(COALESCE(ai_summary,'')) AS ai_summary_len,
  ai_summary_generated_at
FROM civic_items
WHERE id='SF0013' OR bill_number='SF0013'
LIMIT 5;
"

echo ""
echo "Sources:"
./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT
  civic_item_id,
  source_kind,
  status,
  best_doc_url,
  checked_at,
  COALESCE(last_error,'') AS last_error
FROM civic_item_sources
WHERE civic_item_id='SF0013'
ORDER BY checked_at DESC
LIMIT 10;
"

echo ""
echo "Tags:"
./scripts/wr d1 execute WY_DB --local --persist-to "$PERSIST_DIR" --command "
SELECT
  civic_item_id,
  topic_slug,
  confidence,
  LENGTH(COALESCE(reason_summary,'')) AS reason_len
FROM civic_item_ai_tags
WHERE civic_item_id='SF0013'
ORDER BY confidence DESC
LIMIT 10;
"
```

**Success Criteria:** SF0013 appears in all three queries with non-empty fields

---

## Snapshot Sanity: cURL Health Checks

### Prerequisites

Start local worker:

```bash
cd ~/projects/this-is-us/worker
./scripts/wr dev --local --port 8787 --persist-to ./../scripts/wr-persist
```

In another terminal, run these checks:

### A) Health Endpoint

```bash
curl -i "http://127.0.0.1:8787/api/_health"
```

**Expected:** HTTP 200

---

### B) Pending Bills Endpoint

```bash
curl -sS "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | head -200
```

**Expected:** JSON array with pending bills and topic tags

---

### C) Hot Topics Endpoint

```bash
curl -sS "http://127.0.0.1:8787/api/hot-topics" | head -200
```

**Expected:** JSON array with hot topics and counts

---

### D) Force Internal Scan (optional)

```bash
curl -i "http://127.0.0.1:8787/api/internal/civic/scan-pending-bills?force=1"
```

Then re-run **Section B) Row Counts & Basic Health** above to verify counts increased.

---

### E) Podcast Summary Endpoint (sanity check)

```bash
curl -sS "http://127.0.0.1:8787/api/podcast/summary?guest=jr-riggins&date=2025-12-14&part=1" | head -200
```

**Expected:** JSON with podcast summary text

---

## Script Execution Checklist

All scripts must remain executable:

```bash
cd ~/projects/this-is-us/worker

# Verify executable
ls -l scripts/apply-migrations-local.sh
ls -l scripts/audit-wyoleg-ingestion.sh
ls -l scripts/test-wyoleg-pipeline-local.sh
ls -l scripts/test-doc-resolver-local.sh

# Ensure executable (if needed)
chmod +x scripts/apply-migrations-local.sh
chmod +x scripts/audit-wyoleg-ingestion.sh
chmod +x scripts/test-wyoleg-pipeline-local.sh
chmod +x scripts/test-doc-resolver-local.sh
```

---

## Recommended Workflow

1. **Start local dev:**
   ```bash
   cd ~/projects/this-is-us
   ./start_local.sh
   ```

2. **Apply migrations (in another terminal):**
   ```bash
   cd ~/projects/this-is-us/worker
   ./scripts/apply-migrations-local.sh
   ```

3. **Run sanity checks:**
   ```bash
   # Run SQL checks from Section A-E above
   # Run cURL checks from Section A-E above
   ```

4. **If data is missing, run tests:**
   ```bash
   cd ~/projects/this-is-us/worker
   ./scripts/test-wyoleg-pipeline-local.sh
   ./scripts/test-doc-resolver-local.sh
   ```

5. **Audit ingestion state:**
   ```bash
   cd ~/projects/this-is-us/worker
   ./scripts/audit-wyoleg-ingestion.sh
   ```

---

## Orchestrator Test Results (December 16, 2025)

**Endpoint:** POST `/api/internal/admin/wyoleg/run`  
**Status:** ✅ Fully Functional  
**Run ID:** `88e9c321-cc5f-4aed-ac5c-cdd64fca673e`  
**Duration:** 17 seconds  

| Bill Number | Title | Status | Summary | Topics |
|---|---|---|---|---|
| HB 22 | Property Tax Assessment Cap | introduced | ✅ Generated | property-tax-relief |
| HB 164 | Groundwater Withdrawal Permits | in_committee | ✅ Generated | water-rights |
| SF 174 | Budget Reconciliation Act | pending_vote | ✅ Generated | fiscal-policy |
| HB 286 | Education Funding Increase | introduced | ✅ Generated | education |
| SF 89 | Healthcare Coverage Expansion | in_committee | ✅ Generated | healthcare |

**Pipeline Results:**
- ✅ Bills Scanned: 5
- ✅ Summaries Written: 5
- ✅ Tags Written: 5
- ✅ Database Logging: ingestion_runs table updated
- ✅ Zero Errors

**APIs Verified:**
- `GET /api/hot-topics` — Returns 10 topics with civic_items populated
- `GET /api/civic/pending-bills-with-topics?include_flagged=true&include_incomplete=true` — Returns all 5 bills with topics

---

## Known Issues & Resolutions

### Multiple ../scripts/wr directories

**Issue:** Local dev may have both `../scripts/wr/` (ephemeral) and `../scripts/wr-persist/` (persistent).

**Resolution:**
```bash
cd ~/projects/this-is-us/worker
rm -rf ./../scripts/wr ./.config
# Use only ../scripts/wr-persist going forward
```

### Empty local databases

**Issue:** Local databases don't have production data.

**Resolution:** Run migrations + tests:
```bash
cd ~/projects/this-is-us/worker
./scripts/apply-migrations-local.sh
./scripts/test-wyoleg-pipeline-local.sh
```

### Stale documentation

**This snapshot is the single source of truth.** If docs diverge, update them to match this file.

---

## Validation Date

Last validated: **December 16, 2025**

Next validation recommended: Weekly or before major ingestion changes.

---
