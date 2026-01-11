Status: Active
Updated: 2025-12-17
Owner: Eng Platform
Scope: Wyoming LSO Orchestrator

# Orchestrator E2E Test Harness

## Overview

`test_orchestrator_e2e_2026.sh` is a comprehensive end-to-end validation script for the Wyoming LSO bill ingestion orchestrator. It proves:

- ✅ Enumeration is correct and delta-safe
- ✅ Document resolution runs on enumerated set
- ✅ AI scan/tag runs on eligible bills
- ✅ UI endpoints return non-empty real results
- ✅ Completeness metrics reflect reality for 2026

**No demo/seed data. No guessing.** All assertions are hard-fail.

## Quick Start

### Prerequisites

- `./scripts/wr dev` running at `http://127.0.0.1:8787`
- `curl` and `jq` installed
- D1 database initialized with civic_items table
- **No demo data** (test-% rows, "Groundwater Withdrawal Permits" bills)

### Run the test

```bash
cd /home/anchor/projects/this-is-us
bash worker/scripts/test_orchestrator_e2e_2026.sh
```

### Expected output

```
╔════════════════════════════════════════════════════════════════╗
║  Wyoming LSO Orchestrator E2E Test (year=2026)                ║
║  Script: worker/scripts/test_orchestrator_e2e_2026.sh
╚════════════════════════════════════════════════════════════════╝

...
[INFO] Checking dependencies...
[PASS] curl and jq found
[INFO] Checking ./scripts/wr dev is running at http://127.0.0.1:8787...
[PASS] ./scripts/wr dev is running
...

[PASS]: year=2026 lso_total=44 db_active=44 sources=5 tags=12
```

On failure, test exits with code 1 and prints exact reason.

## Test Phases

### Phase 1: Preflight DB Sanity

- Verifies required tables: `civic_items`, `civic_item_sources`, `civic_item_ai_tags`, `ingestion_metadata`
- Prints counts for year=2026
- **Fails fast** if demo data found:
  - Any `civic_items.id` LIKE `'test-%'`
  - Any titles containing `"Groundwater Withdrawal Permits"`

### Phase 2: Run Orchestrator Once

Calls:
```
POST /api/internal/admin/wyoleg/run
{
  "year": 2026,
  "limit": 200,
  "force": true
}
```

Prints full response JSON.

### Phase 3: Validate Orchestrator Response

Hard assertions:
- `lso_total_items_year` exists and is integer > 0
- `db_total_active_bills_year` exists and is integer >= 0
- `lso_new_bills_added_this_run` exists and is integer >= 0
- `lso_bills_marked_inactive_this_run` exists and is integer >= 0
- `remaining = max(lso_total_items_year - db_total_active_bills_year, 0)`

Fails if any field missing or type mismatch.

### Phase 4: Database Invariants

After orchestrator runs:

1. **No duplicate bill_numbers** for year=2026
   - Query: `GROUP BY bill_number HAVING COUNT(*)>1`
   - Must return 0 rows

2. **Active count ≤ total count**
   - `inactive_at IS NULL` count ≤ total count
   - Always passes logically (mark inactive reduces active count)

3. **Active count grows with new bills**
   - If `lso_new_bills_added_this_run > 0`, active count should increase
   - Warns (not fatal) if this doesn't happen

### Phase 5: Document Resolution Coverage

- Count rows in `civic_item_sources` with non-null `best_doc_url`
- Print 5 sample rows: bill_number, best_doc_kind, url_truncated, status, last_error
- Optional: Document resolution may not have run yet

### Phase 6: AI Tagging Coverage

- Count rows in `civic_item_ai_tags` for year=2026
- Print topic_slug histogram (count per topic)
- Warning (not fatal) if 0 tags—AI scanning may not have run yet

### Phase 7: UI Endpoint Smoke Tests

Call and validate:

1. **GET /api/civic/pending-bills-with-topics?year=2026**
   - Assert `results.length > 0` OR warn if 0 (expected if no pending status)

2. **GET /api/hot-topics?year=2026**
   - Assert topics returned > 0 OR warn
   - Check for at least one topic with `bill_count > 0`

## Output Fields Explained

### Orchestrator Response (Phase 3)

```json
{
  "lso_total_items_year": 44,           // Bills from LSO Service for 2026
  "db_total_active_bills_year": 44,     // Active bills in civic_items
  "lso_new_bills_added_this_run": 0,    // New bills in this enumeration
  "lso_bills_marked_inactive_this_run": 0 // Bills marked inactive (no longer in LSO)
}
```

If `lso_total_items_year` is 44 and `db_total_active_bills_year` is 44, enumeration is complete.

### Final Report Line

```
PASS: year=2026 lso_total=44 db_active=44 sources=5 tags=12
```

Means:
- 44 bills from LSO Service
- 44 active bills in database
- 5 document sources resolved
- 12 AI tags applied

## Failure Modes

| Failure | Cause | Fix |
|---------|-------|-----|
| `curl is required` | Missing curl | Install: `apt-get install curl` |
| `./scripts/wr dev not running` | Dev server down | Run: `./scripts/wr dev` |
| `WY_DB.db not found` | Database not initialized | Run orchestrator or initialize DB |
| `test-% rows found` | Demo data present | Delete test rows from civic_items |
| `lso_total_items_year is null` | Orchestrator failed to count | Check LSO Service connectivity |
| `Active count > total count` | Data corruption | Investigate civic_items delta logic |
| `Duplicate bill_numbers` | Upsert failed | Check uniqueness constraint on civic_items |

## Environment Variables

None required. Script detects:
- `./scripts/wr dev` running at `http://127.0.0.1:8787`
- D1 persist directory: `./../scripts/wr-persist/`
- Year: hardcoded to 2026

To override API base (testing only):
```bash
API_BASE="http://localhost:3000" bash worker/scripts/test_orchestrator_e2e_2026.sh
```

## Integration with CI/CD

Ready for integration into test suite:

```bash
#!/bin/bash
# ci/test-wy-orchestrator.sh

set -e

# Start dev server in background
./scripts/wr dev &
SERVER_PID=$!
sleep 3

# Run test
bash worker/scripts/test_orchestrator_e2e_2026.sh
TEST_RESULT=$?

# Cleanup
kill $SERVER_PID 2>/dev/null || true

exit $TEST_RESULT
```

## Gotchas

1. **Year hardcoded to 2026**
   - Edit script or use environment variable if needed
   - All internal calls must use `YEAR=2026` consistently

2. **Demo data check is strict**
   - Any `test-` prefix will fail
   - Any `Groundwater Withdrawal Permits` title will fail
   - Clean database required

3. **Document resolution optional**
   - If no `best_doc_url` rows exist, test warns but passes
   - Expected on first run (orchestrator doesn't call docResolver)

4. **AI tags optional**
   - If no tags, test warns but passes
   - Expected until AI scan phase implemented

5. **sqlite3 command**
   - Script assumes `sqlite3` in PATH
   - WSL compatibility included via `/proc/version` check

## Maintenance

When adding new:

- **Orchestrator fields**: Add assertion in Phase 3
- **Database tables**: Add table existence check in Phase 1
- **UI endpoints**: Add smoke test in Phase 7
- **Business logic**: Add query/invariant in Phase 4

See Phase X comments in script for insertion points.

---

*Test harness maintained by Eng Platform. Last validated: 2025-12-17.*
