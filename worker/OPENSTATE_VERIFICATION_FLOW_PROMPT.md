# OpenStates Verification Pipeline - Execution Prompt (Refined)

**Purpose:** Template for walking through the complete OpenStates + AI verification pipeline end-to-end.  
**Last Updated:** December 10, 2025 (after successful execution)  
**Status:** All steps verified working

---

## Project Context

You are helping on the `this-is-us.org` project. The goal is to implement a structured verification pipeline for Wyoming bills synced from the OpenStates API v3.

### Key Recent Changes by Codex

**Code modifications:**
- `worker/src/lib/openStatesSync.mjs`: Sponsor ingestion from OpenStates detail endpoint
- `worker/src/lib/civicVerification.mjs`: Structural gating logic (5-gate validation)
- `worker/src/routes/internalVerifyBill.mjs`: Persists structural fields to database
- `worker/src/routes/pendingBills.mjs`: Exposes structural fields in API response

**Schema changes:**
- `0020_add_openstates_person_id_to_bill_sponsors.sql`: Sponsor tracking column
- `0021_add_structural_fields_to_civic_item_verification.sql`: 5 structural gating columns

### Environment Setup

```
WSL root: /home/anchor/projects/this-is-us
Worker: /home/anchor/projects/this-is-us/worker
D1 binding: WY_DB (local: ../scripts/wr/state/v3/d1/)
Dev server: http://127.0.0.1:8787 (after `./scripts/wr dev --local`)
```

---

## Task: Walk Pipeline End-to-End

Your job is to validate the pipeline by:
1. Applying schema migrations
2. Syncing bills from OpenStates API
3. Running AI verification with structural gating
4. Verifying API responses include all required fields
5. Confirming test suite passes with no regressions
6. Documenting the complete flow

**Approach:**
- Propose each command before executing (wait for approval)
- Capture and analyze output
- Handle errors with smallest-fix approach
- Keep all changes local-only (use `--local` flag)

---

## STEP 1: Apply Migrations and Verify Schema

### Pre-flight Checks

```bash
# Check current working directory
cd /home/anchor/projects/this-is-us/worker

# List pending migrations
./scripts/wr d1 migrations list WY_DB
```

**Expected:** Should show 0020 and 0021 in "Migrations to be applied" list.

### Apply Migrations

```bash
# Apply all pending migrations (0020, 0021, and others)
./scripts/wr d1 migrations apply WY_DB --local
```

**Expect:** Both should succeed. If column-already-exists errors occur, edit migrations to comment out ALTER TABLE statements (columns exist from previous manual creation).

### Verify Schema

```bash
# Check bill_sponsors structure (look for openstates_person_id)
./scripts/wr d1 execute WY_DB --local --command "PRAGMA table_info(bill_sponsors);" | jq '.results[][] | {cid, name, type}'

# Check civic_item_verification structure (look for structural fields)
./scripts/wr d1 execute WY_DB --local --command "PRAGMA table_info(civic_item_verification);" | jq '.results[][] | {cid, name, type}'
```

**Expect columns in civic_item_verification:**
- `is_wyoming` (INTEGER)
- `has_summary` (INTEGER)
- `has_wyoming_sponsor` (INTEGER)
- `structural_ok` (INTEGER)
- `structural_reason` (TEXT)

---

## STEP 2: Reset and Re-sync OpenStates Bills

### Check Environment Variables

```bash
# Verify OPENSTATES_API_KEY is in ./scripts/wr.toml
grep OPENSTATES_API_KEY worker/./scripts/wr.toml

# Should output something like:
# OPENSTATES_API_KEY    = "34c97a5b-a758-407a-961f-7bfd54460c5c"
```

### Reset Data (Optional)

```bash
# Reset all Wyoming OpenStates bills (clean slate)
./scripts/wr d1 execute WY_DB --local --file db/admin/reset_openstates_wy_db.sql

# Verify count is 0
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT COUNT(*) as count FROM civic_items WHERE source='open_states';"
```

**Expected:** `count: 0`

### Run OpenStates Sync

```bash
# Start dev server (if not already running in background)
./scripts/wr dev --local &

# Wait ~10 seconds for server to start, then sync
curl -s "http://127.0.0.1:8787/api/dev/openstates/sync?session=2025" | jq '.synced, .count, .errors'
```

**Expected:** `synced: 20, count: 20, errors: 0`

### Verify Bill and Sponsor Counts

```bash
# Count bills and sponsors
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT 
    (SELECT COUNT(*) FROM civic_items WHERE source='open_states') as bills,
    (SELECT COUNT(*) FROM bill_sponsors) as sponsors;"

# Sample bills with sponsor count
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT 
    ci.bill_number, 
    ci.chamber,
    COUNT(bs.id) as sponsors
  FROM civic_items ci
  LEFT JOIN bill_sponsors bs ON bs.civic_item_id = ci.id
  WHERE ci.source='open_states'
  GROUP BY ci.id
  HAVING sponsors > 0
  LIMIT 5;"
```

**Expected:** 
- ~20 bills, ~15 sponsors (not all bills have sponsors)
- Chamber distribution: ~3 HB (house), ~7 SF (senate)
- All bills have jurisdiction_key='WY'

---

## STEP 3: Generate Summaries and Run Verification

### Generate AI Summary for Sample Bill

```bash
# Pick first bill
BILL_ID=$(curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?session=2025" | \
  jq -r '.results[] | select(.source=="open_states") | .id' | head -1)

# Generate summary
curl -s -X POST "http://127.0.0.1:8787/api/internal/civic/test-bill-summary?bill_id=$BILL_ID&save=true" | jq '.ai_summary'
```

### Verify the Bill

```bash
# Verify the bill
curl -s "http://127.0.0.1:8787/api/internal/civic/verify-bill?id=$BILL_ID" | jq '.verification'
```

**Expected output:**
```json
{
  "status": "flagged",  // or "ok" if all gates pass
  "structural_ok": false,  // or true
  "structural_reason": "no_wyoming_sponsor",  // why it failed (if any)
  "is_wyoming": true,
  "has_summary": true,
  "has_wyoming_sponsor": false,
  "topic_match": false,
  "summary_safe": true
}
```

### Check Verification Counts

```bash
# Count status distribution
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT 
    status, 
    structural_ok,
    COUNT(*) as count
  FROM civic_item_verification
  WHERE civic_item_id IN (SELECT id FROM civic_items WHERE source='open_states')
  GROUP BY status, structural_ok;"
```

**Expected:** Mix of 'ok' and 'flagged' based on structural gates.

---

## STEP 4: Verify Pending Bills API

### Check API Response

```bash
# Get pending bills (session 2025)
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?session=2025" | jq '.results[0]'
```

**Verify response includes:**
- ✅ `verification_status` (e.g., "flagged", "ok", "missing")
- ✅ `verification_confidence` (0-1 or null)
- ✅ `structural_ok` (boolean or null)
- ✅ `structural_reason` (string or null)
- ✅ `has_summary` (boolean or null)
- ✅ `has_wyoming_sponsor` (boolean or null)
- ✅ `is_wyoming` (boolean or null)

### Check for Inconsistencies

```bash
# Find bills where structural_ok=false but status='ok' (BUG indicator)
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?session=2025" | \
  jq '.results[] | select(.structural_ok==false and .verification_status=="ok")'
```

**Expected:** Empty result (should never happen - if it does, there's a bug in civicVerification logic).

---

## STEP 5: Test Suite Validation

### Run Verification Tests Only

```bash
cd /home/anchor/projects/this-is-us

# Run civicVerification tests
npm test -- --runInBand worker/__tests__/civicVerification.test.mjs
```

**Expected:** 
```
PASS worker/__tests__/civicVerification.test.mjs
  ✓ returns ok only when Wyoming bill has summary, sponsor, and model passes
  ✓ flags missing summary even if model matches
  ✓ flags missing Wyoming sponsor
  ✓ flags wrong jurisdiction bills

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

### Run Full Test Suite

```bash
# Full suite (expect some pre-existing failures)
npm test -- --runInBand
```

**Expected outcomes:**
- ✅ civicVerification tests: ALL PASS (4/4)
- ⚠️ Some test suites fail (pre-existing, unrelated):
  - townhall tests (Firebase/Request undefined)
  - Leaflet mocks (geocoding UI tests)
  - Firebase CDN import errors
- ✅ No NEW failures in verification/pending-bills related tests

**How to verify no regressions:**
- Check stack traces - should NOT mention:
  - `civicVerification.mjs`
  - `internalVerifyBill.mjs`
  - `pendingBills.mjs`
  - `openStatesSync.mjs`

---

## STEP 6: Documentation

### Create/Update Runbook

Create file: `worker/OPENSTATES_VERIFICATION_RUNBOOK.md`

**Must include:**

1. **Structural gating gates (5 gates for status='ok'):**
   - source='open_states'
   - jurisdiction_key='WY'
   - ai_summary is not null
   - mapped Wyoming legislator sponsor exists
   - topic_match AND summary_safe both true from AI model

2. **Running the sync:**
   ```bash
   curl "http://127.0.0.1:8787/api/dev/openstates/sync?session=2025"
   ```

3. **Verifying a bill:**
   ```bash
   curl "http://127.0.0.1:8787/api/internal/civic/verify-bill?id=BILL_ID"
   ```

4. **Checking results:**
   ```bash
   ./scripts/wr d1 execute WY_DB --local --command \
     "SELECT bill_number, status, structural_reason FROM civic_item_verification WHERE ...;"
   ```

5. **Test validation:**
   - civicVerification tests should pass (4/4)
   - Some legacy tests may fail (not our responsibility)

6. **Troubleshooting:**
   - "All bills flagged with no_wyoming_sponsor?" → wy_legislators table is empty (expected until legislator data is populated)
   - "Sponsors synced but not matching?" → Name matching is case-sensitive, requires exact match to wy_legislators

---

## Important Notes

### Local-Only Execution
- All commands use `--local` flag
- No production/preview databases affected
- Data persists in `../scripts/wr/state/v3/d1/` directory

### Migration Gotchas
- D1 SQLite doesn't support `IF NOT EXISTS` on ALTER TABLE ADD COLUMN
- If column already exists, comment out the ALTER statement
- CREATE INDEX IF NOT EXISTS is safe to repeat

### Wyoming Legislator Matching
- Currently `wy_legislators` table is empty
- All bills will show `has_wyoming_sponsor=false` (expected)
- Once legislators are populated, sponsor matching will work and more bills will reach status='ok'

### Test Suite Reality
- 5 test suites have pre-existing failures (Firebase, Leaflet, townhall)
- These are NOT related to OpenStates/verification changes
- We only care that civicVerification tests pass (they do)

---

## Checklist for Success

- [ ] Migrations 0020, 0021 applied without errors
- [ ] Schema verified: openstates_person_id in bill_sponsors ✓
- [ ] Schema verified: 5 structural columns in civic_item_verification ✓
- [ ] 20 bills synced from OpenStates ✓
- [ ] 15+ sponsor records ingested ✓
- [ ] AI summaries generated for sample bills ✓
- [ ] Bills verified with structural gating applied ✓
- [ ] Verification records persisted to database ✓
- [ ] API response includes all structural fields ✓
- [ ] civicVerification tests all pass (4/4) ✓
- [ ] No new test failures introduced ✓
- [ ] Runbook created with full instructions ✓

---

## If Pipeline Fails at Any Step

**General troubleshooting approach:**

1. **Capture exact error message** - copy/paste full output
2. **Identify error type:**
   - Schema error? (migration syntax)
   - API error? (network, auth, malformed request)
   - Data error? (missing records, wrong values)
   - Code error? (logic bug, missing import)
3. **Propose minimal fix** - don't rebuild from scratch
4. **Test the fix locally** before declaring success

**Common issues and fixes:**

| Issue | Cause | Fix |
|-------|-------|-----|
| "duplicate column" on 0020/0021 | Column already created manually | Comment out ALTER statements |
| "OPENSTATES_API_KEY not found" | Missing env var | Check ./scripts/wr.toml `[vars]` section |
| Sync returns 0 bills | API auth failure or wrong params | Verify API key, check query params (session=2025) |
| No sponsors synced | Detail endpoint parsing failed | Check OpenStates API response format, add logging |
| All bills "flagged" for no_wyoming_sponsor | wy_legislators empty | Expected - populate legislator table separately |
| Verification tests fail | Code regression | Check recent changes to civicVerification.mjs or internalVerifyBill.mjs |

---

## Files to Review After Execution

- `worker/OPENSTATES_VERIFICATION_RUNBOOK.md` - Documentation of complete flow
- `worker/src/lib/openStatesSync.mjs` - Sponsor ingestion logic
- `worker/src/lib/civicVerification.mjs` - Structural gating gates
- `worker/src/routes/internalVerifyBill.mjs` - Verification endpoint + persistence
- `worker/__tests__/civicVerification.test.mjs` - Unit tests (should pass)

---

**Created:** December 10, 2025  
**Status:** Ready for reuse on future pipeline validations
