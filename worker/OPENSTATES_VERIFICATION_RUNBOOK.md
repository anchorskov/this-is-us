# OpenStates Verification Pipeline Runbook

**Date:** December 10, 2025  
**Status:** ✅ Verified and tested end-to-end

---

## Overview

This runbook documents the complete OpenStates bill ingestion and AI verification pipeline, including:
- Schema migrations for sponsor tracking and structural gating
- Bill synchronization from OpenStates API v3
- Sponsor ingestion and mapping
- AI-based verification with structural guardrails
- Verification result persistence and querying

---

## Prerequisites

- **Wrangler CLI:** v4.52.1 or later
- **Node.js:** Latest version
- **Environment Variables:**
  - `OPENSTATES_API_KEY`: API key for OpenStates v3 API (see `worker/wrangler.toml`)
  - `OPENAI_API_KEY`: API key for OpenAI (gpt-4o-mini)
- **Dev Server:** Running `npx wrangler dev --local` in `/home/anchor/projects/this-is-us/worker`

---

## STEP 1: Apply Migrations

Migrations 0020 and 0021 add support for sponsor tracking and structural verification gating.

### Migration 0020: Add OpenStates Person ID to Bill Sponsors
- **File:** `worker/migrations_wy/0020_add_openstates_person_id_to_bill_sponsors.sql`
- **What it does:**
  - Adds `openstates_person_id` TEXT column to `bill_sponsors` table
  - Creates index on `openstates_person_id` for fast sponsor lookups
  - Enables mapping OpenStates sponsorship data to local records

### Migration 0021: Add Structural Fields to Civic Item Verification
- **File:** `worker/migrations_wy/0021_add_structural_fields_to_civic_item_verification.sql`
- **What it does:**
  - Adds 5 new columns to `civic_item_verification` table:
    - `is_wyoming` (INTEGER): Whether bill jurisdiction is Wyoming
    - `has_summary` (INTEGER): Whether bill has an AI summary
    - `has_wyoming_sponsor` (INTEGER): Whether bill has a mapped Wyoming legislator as sponsor
    - `structural_ok` (INTEGER): Whether all structural gates pass (1=pass, 0=fail)
    - `structural_reason` (TEXT): Why structural gate failed (e.g., `missing_summary`, `no_wyoming_sponsor`)
  - Creates index on `(structural_ok, status)` for efficient querying

### Running Migrations

```bash
cd /home/anchor/projects/this-is-us/worker

# Apply all pending migrations (0020, 0021, and others)
npx wrangler d1 migrations apply WY_DB --local

# Verify the new columns exist
npx wrangler d1 execute WY_DB --local --command "PRAGMA table_info(bill_sponsors);"
npx wrangler d1 execute WY_DB --local --command "PRAGMA table_info(civic_item_verification);"
```

### Expected Output

```
✔ About to apply 2 migration(s)
🚣 2 commands executed successfully

┌─────────────────────────────────────────────────┬────────┐
│ name                                            │ status │
├─────────────────────────────────────────────────┼────────┤
│ 0020_add_openstates_person_id_to_bill_sponsors  │ ✅     │
├─────────────────────────────────────────────────┼────────┤
│ 0021_add_structural_fields_to_civic_item...sql  │ ✅     │
└─────────────────────────────────────────────────┴────────┘
```

---

## STEP 2: Re-sync OpenStates Bills

### Reset Existing Data (Optional)

If you want to start fresh, remove all OpenStates bills:

```bash
# Reset all Wyoming OpenStates bills and related data
npx wrangler d1 execute WY_DB --local --file db/admin/reset_openstates_wy_db.sql

# Verify count is 0
npx wrangler d1 execute WY_DB --local --command \
  "SELECT COUNT(*) as remaining FROM civic_items WHERE source='open_states';"
```

### Start Dev Server

```bash
# In a separate terminal from the worker root
npx wrangler dev --local
```

The server will be available at `http://127.0.0.1:8787`.

### Run OpenStates Sync

The sync endpoint is dev-only and checks for `localhost` connections. It:
1. Fetches up to 20 bills (default) from OpenStates v3 API for Wyoming, session 2025
2. Validates each bill is from Wyoming jurisdiction
3. Detects chamber (HB=house, SF=senate) using bill identifier prefix
4. Inserts/updates bills in `civic_items` table (source='open_states')
5. Fetches detailed bill info including sponsorships
6. Inserts sponsors into `bill_sponsors` table with `openstates_person_id` mapping

```bash
# Sync default batch (20 bills)
curl "http://127.0.0.1:8787/api/dev/openstates/sync?session=2025"

# Or sync with custom limit
curl "http://127.0.0.1:8787/api/dev/openstates/sync?session=2025&limit=500"
```

### Expected Output

```json
{
  "synced": 20,
  "sample": [
    {
      "id": "ocd-bill/3bf03922-22fb-406e-a83b-54f93849e03f",
      "bill_number": "HB 22",
      "title": "Water and wastewater operator-emergency response.",
      "status": "introduced",
      "last_action_date": null
    }
  ],
  "session": "2025",
  "count": 20,
  "skipped": 0,
  "errors": 0,
  "billDetails": [...],
  "skippedBills": []
}
```

### Verify Sync Results

```bash
# Check counts
npx wrangler d1 execute WY_DB --local --command \
  "SELECT 
    (SELECT COUNT(*) FROM civic_items WHERE source='open_states') as bills,
    (SELECT COUNT(*) FROM bill_sponsors) as sponsors;"

# Check sample bills with sponsors
npx wrangler d1 execute WY_DB --local --command \
  "SELECT 
    ci.bill_number, 
    ci.chamber,
    COUNT(bs.id) as sponsor_count
  FROM civic_items ci
  LEFT JOIN bill_sponsors bs ON bs.civic_item_id = ci.id
  WHERE ci.source='open_states'
  GROUP BY ci.id
  HAVING sponsor_count > 0
  LIMIT 5;"
```

---

## STEP 3: Run AI Verification

The verification endpoint uses gpt-4o-mini to validate bills against structural guardrails and AI model checks.

### Structural Gating Logic

**For OpenStates bills (source='open_states'), status='ok' ONLY if ALL these are true:**

1. **is_wyoming:** `jurisdiction_key = 'WY'`
2. **has_summary:** Bill has a non-empty `ai_summary` (must run step-bill-summary first)
3. **has_wyoming_sponsor:** Bill has at least one sponsor matched to `wy_legislators` table
4. **topic_match:** AI model says the stored topic matches the bill title/abstract
5. **summary_safe:** AI model says the summary makes claims consistent with bill title/abstract

**If any structural check fails, status is set to 'flagged' with structural_reason:**
- `wrong_jurisdiction`: Not from Wyoming
- `missing_summary`: No AI summary
- `no_wyoming_sponsor`: No mapped Wyoming legislator sponsor
- `model_mismatch`: AI model returns topic_match=false OR summary_safe=false

### Verify a Single Bill

```bash
# Get a bill ID
BILL_ID=$(curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?session=2025" | \
  jq -r '.results[] | select(.source=="open_states") | .id' | head -1)

# Generate AI summary first
curl -s -X POST "http://127.0.0.1:8787/api/internal/civic/test-bill-summary?bill_id=$BILL_ID&save=true"

# Verify the bill
curl -s "http://127.0.0.1:8787/api/internal/civic/verify-bill?id=$BILL_ID" | jq '.verification'
```

### Expected Output

```json
{
  "stored_topic": null,
  "openai_topics": ["water-rights"],
  "topic_match": false,
  "summary_safe": true,
  "issues": ["no_wyoming_sponsor"],
  "confidence": 0.8,
  "status": "flagged",
  "model": "gpt-4o-mini",
  "created_at": "2025-12-10T18:21:30.014Z",
  "structural_ok": false,
  "structural_reason": "no_wyoming_sponsor",
  "is_wyoming": true,
  "has_summary": true,
  "has_wyoming_sponsor": false,
  "status_reason": "no_wyoming_sponsor"
}
```

### Check Verification Results

```bash
# Count status distribution
npx wrangler d1 execute WY_DB --local --command \
  "SELECT 
    status, 
    structural_ok, 
    structural_reason,
    COUNT(*) as count
  FROM civic_item_verification
  WHERE civic_item_id IN (
    SELECT id FROM civic_items WHERE source='open_states'
  )
  GROUP BY status, structural_ok, structural_reason;"

# Show flagged bills and why
npx wrangler d1 execute WY_DB --local --command \
  "SELECT 
    ci.bill_number,
    civ.status,
    civ.structural_reason,
    civ.has_summary,
    civ.has_wyoming_sponsor,
    civ.topic_match,
    civ.summary_safe
  FROM civic_item_verification civ
  JOIN civic_items ci ON ci.id = civ.civic_item_id
  WHERE ci.source='open_states'
  AND civ.status='flagged'
  LIMIT 10;"
```

---

## STEP 4: Query Pending Bills API

The pending bills API surfaces all verification data including structural fields.

### API Endpoint

```
GET /api/civic/pending-bills-with-topics?session=2025&chamber=house&status=introduced
```

### Response Fields (Structural Gating)

```json
{
  "id": "ocd-bill/...",
  "bill_number": "HB 22",
  "title": "...",
  "chamber": "house",
  "status": "introduced",
  "legislative_session": "2025",
  "verification_status": "flagged",
  "verification_confidence": 0.8,
  "structural_ok": false,
  "structural_reason": "no_wyoming_sponsor",
  "has_summary": true,
  "has_wyoming_sponsor": false,
  "is_wyoming": true,
  "ai_plain_summary": "...",
  "ai_key_points": [...],
  "sponsors": [
    {
      "sponsor_name": "Campbell",
      "sponsor_role": "primary",
      "sponsor_district": null
    }
  ],
  "topics": [...]
}
```

### Sample Query

```bash
# Get all OpenStates bills with verification status
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?session=2025" | \
  jq '.results[] | select(.id | startswith("ocd-bill")) | {bill_number, verification_status, structural_reason}'
```

### Count by Status

```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?session=2025" | \
  jq '.results | map(select(.id | startswith("ocd-bill"))) | group_by(.verification_status) | map({status: .[0].verification_status, count: length})'
```

---

## STEP 5: Test Suite

### Run Verification Tests (Should Pass)

```bash
cd /home/anchor/projects/this-is-us

# Run just civicVerification tests
npm test -- --runInBand worker/__tests__/civicVerification.test.mjs

# Expected output
# ✓ returns ok only when Wyoming bill has summary, sponsor, and model passes
# ✓ flags missing summary even if model matches
# ✓ flags missing Wyoming sponsor
# ✓ flags wrong jurisdiction bills
# 
# Test Suites: 1 passed, 1 total
# Tests:       4 passed, 4 total
```

### Run Full Test Suite (Some pre-existing failures expected)

```bash
npm test -- --runInBand

# Expected: civicVerification tests should pass (4/4)
# Pre-existing failures in:
# - townhall.verified.test.mjs (Module import error)
# - townhall-create-thread-client.test.js (Firebase CDN module)
# - Event-creation helpers (Leaflet mocking)
```

### Important: No New Failures

All civicVerification and verification-related tests should pass. Any failures in those test files indicate a regression.

---

## Troubleshooting

### Issue: `no_wyoming_sponsor` for all bills

**Cause:** The `wy_legislators` table is empty. Sponsor matching requires legislator data.

**Solution:**
1. Populate `wy_legislators` table with Wyoming legislator data
2. Or: For testing, manually insert test legislators matching bill sponsor names

```bash
# Example: Insert test legislator
npx wrangler d1 execute WY_DB --local --command \
  "INSERT INTO wy_legislators (name, chamber, district, created_at, updated_at)
   VALUES ('Campbell', 'house', null, datetime('now'), datetime('now'));"
```

### Issue: Bills syncing but no sponsors

**Possible causes:**
1. OpenStates API returned empty sponsorships array for those bills
2. Sponsor parsing failed (check logs for sponsor ingestion warnings)

**Debug:**
```bash
# Check bills with and without sponsors
npx wrangler d1 execute WY_DB --local --command \
  "SELECT 
    ci.bill_number,
    COUNT(bs.id) as sponsor_count
  FROM civic_items ci
  LEFT JOIN bill_sponsors bs ON bs.civic_item_id = ci.id
  WHERE ci.source='open_states'
  GROUP BY ci.id
  ORDER BY sponsor_count DESC;"
```

### Issue: Verification returns `missing_summary`

**Cause:** Bill AI summary is null. Summary generation hasn't been run.

**Solution:**
```bash
# Generate summary for the bill
curl -s -X POST "http://127.0.0.1:8787/api/internal/civic/test-bill-summary?bill_id=BILL_ID&save=true"

# Then re-verify
curl -s "http://127.0.0.1:8787/api/internal/civic/verify-bill?id=BILL_ID"
```

---

## Architecture Notes

### Files Modified/Created

| File | Purpose |
|------|---------|
| `worker/src/lib/openStatesSync.mjs` | Bill sync with sponsor ingestion (detail endpoint) |
| `worker/src/lib/civicVerification.mjs` | Structural gating logic + AI model verification |
| `worker/src/routes/internalVerifyBill.mjs` | Verification endpoint, persists structural fields |
| `worker/src/routes/pendingBills.mjs` | API exposes structural fields in response |
| `worker/migrations_wy/0020_*.sql` | Add openstates_person_id column |
| `worker/migrations_wy/0021_*.sql` | Add structural gating columns |
| `worker/__tests__/civicVerification.test.mjs` | Unit tests for gating logic (4 tests) |

### Key Functions

**openStatesSync.mjs:**
- `syncWyomingBills(env, db, {session, limit})` - Sync bills from API + sponsor ingestion
- `upsertBillSponsors(db, civicItemId, detailedBill)` - Extract and store sponsors
- `normalizeChamber(org, identifier)` - HB/SF prefix detection (primary), org fallback

**civicVerification.mjs:**
- `verifyBillWithMiniModel(env, {bill, aiSummary, storedTopic, hotTopics, hasWyomingSponsor})` - Main verification logic
- `buildStructuralChecks(...)` - Checks is_wyoming, has_summary, has_wyoming_sponsor gates

**internalVerifyBill.mjs:**
- `handleInternalVerifyBill(request, env)` - HTTP endpoint, calls verifyBillWithMiniModel, persists to DB

---

## Next Steps (Not Yet Implemented)

1. **Populate wy_legislators table** with actual Wyoming legislator data
   - Will enable `has_wyoming_sponsor=1` for bills with mapped sponsors
   - Will change status='flagged' → 'ok' for bills passing all gates

2. **Batch verification endpoint** - Verify multiple bills in one call
   - Reuse single-bill logic with loop + rate limiting
   - Enable bulk verification of all pending bills

3. **Auto-summary generation** - Generate summaries for all new bills
   - Can run on sync completion or as background job
   - Will enable more bills to pass `has_summary` gate

---

## Data Quality Notes

**What OpenStates v3 API provides:**
- ✅ Bill identifier (HB/SF), title, chamber (via org)
- ✅ Jurisdiction (validated)
- ✅ Status (determined from actions)
- ✅ Sponsors with openstates_person_id
- ⚠️ Abstracts/summaries (sparse, missing for many bills)

**What we add:**
- ✅ AI-generated plain-language summaries
- ✅ AI-detected topic assignments
- ✅ Structural verification with guardrails
- ✅ Wyoming legislator sponsor matching (pending legislator data)

---

## Related Documentation

- `OPENSTATES_API_STRUCTURE.md` - Detailed API field mapping
- `OPENSTATES_ANALYSIS_2025-12-10.md` - Chamber detection issue analysis
- `OPENSTATES_FIX_REPORT_2025-12-10.md` - Testing results of chamber detection fix

---

**Last Updated:** December 10, 2025  
**Verified By:** End-to-end testing with 20 bills synced, 3 verified
