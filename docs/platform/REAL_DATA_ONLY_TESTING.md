# Real Data Only: Wyoming LSO Testing Guide

## Overview

**New Test Script:** `worker/scripts/test-wyoleg-real-data-local.sh`

This script enforces **real-data-only testing** - no seed/demo bills. All ingested data traces to:
- Wyoming Legislature (wyoleg.gov) official source
- OpenStates API (as enrichment layer only)
- Verified bill identifiers matching official records

## Key Features

1. **Pre-flight Guards:** Detects and rejects demo/test data before pipeline runs
2. **Demo Data Detection:** Fails fast if finds:
   - IDs starting with `test-`
   - Known demo bill titles (Property Tax Assessment Cap, Groundwater Withdrawal, etc.)
   - Bills without wyoleg.gov URL patterns
3. **DB Cleanup Mode:** `--reset` deletes all civic_items, sources, and tags, then re-syncs from real sources
4. **Provenance Validation:** Confirms all bills link to wyoleg.gov PDFs
5. **Reporting:** Shows first 10 bills with source URLs, summaries, and hot topic tags

## Seed Script Guard

**Important:** `seed-test-bills.sh` now requires explicit approval to prevent accidental test data injection.

```bash
# This will FAIL without explicit opt-in:
bash seed-test-bills.sh
# ❌ ERROR: Seeding test bills requires explicit approval.
#    Use: ALLOW_TEST_SEEDS=1 bash seed-test-bills.sh

# To seed test bills intentionally:
ALLOW_TEST_SEEDS=1 bash seed-test-bills.sh
```

## Usage

### Run with existing real data (validates no demo data present):

```bash
cd ~/projects/this-is-us/worker
./scripts/test-wyoleg-real-data-local.sh
```

**Output:**
- Pre-flight checks verify no demo/test data
- Validates at least 5 real bills in database
- Shows provenance report (bill numbers, titles, wyoleg.gov URLs, summaries, topics)
- Exits non-zero if demo data detected

### Reset mode (clean DB and re-fetch real data):

```bash
cd ~/projects/this-is-us/worker
./scripts/test-wyoleg-real-data-local.sh --reset
```

**Steps:**
1. Deletes all civic_items, civic_item_sources, civic_item_ai_tags
2. Calls orchestrator endpoint to sync from real OpenStates/wyoleg.gov sources
3. Runs document resolver to fetch actual Wyoming Legislature PDFs
4. Runs AI analysis (summaries + hot topic tagging)
5. Validates all bills have wyoleg.gov provenance
6. Prints final provenance report

## Pre-flight Check Details

The script validates:

```bash
# Check 1: No test- IDs
SELECT COUNT(*) FROM civic_items WHERE id LIKE 'test-%';
# Expected: 0

# Check 2: No demo titles
SELECT COUNT(*) FROM civic_items WHERE 
  title LIKE '%Property Tax Assessment Cap%' OR
  title LIKE '%Groundwater Withdrawal%' OR
  title LIKE '%Renewable Energy Transmission Permitting%' OR
  title LIKE '%Fentanyl Interdiction%';
# Expected: 0

# Check 3: All openstates bills have wyoleg.gov URLs or will be resolved
SELECT COUNT(*) FROM civic_items 
  WHERE source='openstates' 
  AND COALESCE(external_url,'') <> '' 
  AND external_url NOT LIKE '%wyoleg.gov/Legislation/%';
# Acceptable: any number (doc resolver will fix)
```

## Provenance Report Example

```
BILLS WITH REAL DATA VALIDATION

HB 22
  Title: Property Tax Assessment Cap
  Source URL: https://openstates.org/wy/bills/2025/HB%2022/
  wyoleg.gov: https://wyoleg.gov/Legislation/2025/HB0022?pdf=/Documents/2025/Introduced/HB0022.pdf
  Summary: 847 chars
  Topics: property-tax-relief, fiscal-impact

SF 174
  Title: K-12 Education Funding Formula
  Source URL: https://openstates.org/wy/bills/2025/SF%20174/
  wyoleg.gov: https://wyoleg.gov/Legislation/2025/SF0174?pdf=/Documents/2025/Introduced/SF0174.pdf
  Summary: 1203 chars
  Topics: education-funding, state-budget
```

All URLs must contain `wyoleg.gov` and end with `.pdf` or be properly resolved by doc resolver.

## Validation Metrics

Script reports:
- **Total bills in database** - must be >= 5 for real data
- **Bills with wyoleg.gov URLs** - must be > 0 after doc resolution
- **AI tags applied** - must be > 0 (indicates scanning completed)
- **Demo/test data** - must be == 0 (fails if found)

## When to Use Real Data Only Test

### ✅ Use for:
- Validating pipeline works with actual Wyoming Legislature data
- Before any production deployment
- Regularly (weekly) to catch data drift
- After schema changes to ensure everything still works

### ❌ Don't use for:
- Quick local testing (use demo seeds with ALLOW_TEST_SEEDS=1 if needed)
- API endpoint testing that doesn't care about bill origin
- Development iterations (real data takes longer)

## Troubleshooting

### No bills scanned (synced_count = 0)?
- OpenStates API not configured (missing OPENSTATES_API_KEY)
- Acceptable in local testing; focus on orchestrator endpoint structure
- Check: `curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run -d '{"limit":1}' | jq`

### No wyoleg.gov URLs found?
- Doc resolver not running or skipped (common in local without full config)
- Not a blocker; validate orchestrator structure instead
- Check: `SELECT COUNT(*) FROM civic_item_sources WHERE best_doc_url LIKE '%wyoleg.gov%';`

### Script says "Demo data detected" but I want to test?
- Run `--reset` mode first to clean database
- Or use `ALLOW_TEST_SEEDS=1 bash seed-test-bills.sh` if testing with known data
- Always choose real data for production validation

## Script Options

### `test-wyoleg-real-data-local.sh --reset`
Clean mode - deletes all civic_items, sources, and tags, then re-fetches from real sources.

### `test-wyoleg-real-data-local.sh`
Validate mode - checks existing data for demo/test entries, validates provenance.

## Full Execution Flow

1. **Database Access Check** - Verify WY_DB is accessible
2. **Pre-flight Checks** (unless --reset) - Scan for test- IDs and demo titles
3. **Database Reset** (if --reset) - Delete civic_items, sources, tags
4. **Pipeline Execution** - POST to `/api/internal/admin/wyoleg/run` endpoint
5. **Data Validation** - Verify bills synced, sources resolved, tags applied
6. **Provenance Report** - Display first 10 bills with wyoleg.gov URLs
7. **Summary** - Show validation results

## Related Scripts

- **`seed-test-bills.sh`** - Seed demo Wyoming bills (requires ALLOW_TEST_SEEDS=1)
- **`test-wyoleg-orchestrator-local.sh`** - Orchestrator endpoint test
- **`apply-migrations-local.sh`** - Apply D1 migrations
- **`audit-wyoleg-ingestion.sh`** - Audit pipeline state

## Environment Requirements

- Wrangler dev running: `http://127.0.0.1:8787`
- Persist directory: `./../scripts/wr-persist` (within worker/)
- D1 databases: WY_DB, EVENTS_DB
- OpenStates API key (optional, for real bill sync)

## Data Provenance Chain

```
wyoleg.gov (official source)
    ↓
OpenStates API (enrichment, bill list)
    ↓
civic_items table (bill metadata + external_url)
    ↓
Document resolver (fetches wyoleg.gov PDFs)
    ↓
civic_item_sources table (best_doc_url = wyoleg.gov PDF)
    ↓
AI analysis (summary + hot topic tags)
    ↓
civic_item_ai_tags table (tagged topics with confidence)
    ↓
API endpoints (/api/hot-topics, /api/pending-bills-with-topics)
```

All steps validate and trace back to wyoleg.gov official sources.
