Status: Active
Updated: 2025-12-17
Owner: Eng Platform
Scope: wyoleg/enumeration

# Composite ID Enforcement & Duplicate Reconciliation

## Problem
Enumeration was creating duplicate rows for the same bill in a session:
- **Legacy format**: `id = "HB0011"` with `legislative_session = "2026"`
- **Canonical format**: `id = "2026_HB0011"` with `legislative_session = "2026"`
- Both formats can exist for the same bill_number, creating duplicates

Root cause: Multiple code paths were creating bill records with different ID formats
- `wyLsoEnumerate.mjs`: Correctly using `${year}_${billNum}` format
- `wyLsoClient.mjs`: Still using legacy `billNum` format

## Solution
Enforce single canonical ID format (`${year}_${billNum}`) for all LSO enumerations.

### 1. Code Changes

#### wyLsoClient.mjs (buildCivicItemFromLso function)
Changed from legacy ID format to composite ID format:
```javascript
// BEFORE: id: billNumber  // e.g., "HB0011"
// AFTER: const compositeId = `${year}_${billNumber}`; // e.g., "2026_HB0011"
```
This ensures committee-sponsor bills also use composite IDs.

#### wyLsoEnumerate.mjs (new functions)
Added reconciliation functions:
- `reconcileLegacyDuplicates(db, year)` - Mark legacy rows inactive when canonical rows exist
- `getLegacyDuplicateCountForYear(db, year)` - Count remaining legacy duplicates for diagnostics

#### adminWyoleg.mjs (orchestrator)
- Call `reconcileLegacyDuplicates()` after enumeration to clean up legacy rows
- Track `db_total_legacy_duplicates_year` metric for diagnostics
- Count only canonical IDs in `db_total_active_bills_year` (using `id LIKE 'YYYY_%'`)

### 2. New Diagnostic Script

**Script**: `worker/scripts/check-session-duplicates.sh`

Shows:
- Canonical ID count (format: YYYY_BILL)
- Legacy ID count (format: BILL)
- List of duplicate bill_numbers
- Reconciliation status

**Usage**:
```bash
cd /home/anchor/projects/this-is-us/worker
bash scripts/check-session-duplicates.sh 2026
bash scripts/check-session-duplicates.sh 2025
```

**Example output for 2026** (clean):
```
=== Checking duplicates for session 2026 ===
Active Canonical IDs (2026_BILL):  44
Active Legacy IDs (BILL):            0
✅ No legacy duplicates found for 2026
Total bills in session 2026:     44
Reconciliation Status: ✅ CLEAN
```

## Orchestrator Metrics

The run response now includes:
- `db_total_active_bills_year` - Count of canonical IDs only (e.g., "2026_HB0011")
- `db_total_legacy_duplicates_year` - Count of legacy format rows still active
- `lso_new_bills_added_this_run` - Bills actually added to database

**Example enumeration response**:
```json
{
  "lso_total_items_year": 44,
  "lso_new_bills_added_this_run": 0,
  "db_total_active_bills_year": 44,
  "db_total_legacy_duplicates_year": 0,
  "complete": true
}
```

## Testing

### Test Commands

**Run enumeration for 2026**:
```bash
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"enumerate","limit":500,"force":true}'
```

**Check for duplicates**:
```bash
cd /home/anchor/projects/this-is-us/worker
bash scripts/check-session-duplicates.sh 2026
```

**Verify in database** (canonical only):
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT COUNT(*) FROM civic_items WHERE legislative_session='2026' AND id LIKE '2026_%';"
```

**Verify legacy count** (should be 0 after reconciliation):
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT COUNT(*) FROM civic_items WHERE legislative_session='2026' AND id NOT LIKE '2026_%';"
```

### Test Results (2026)

✅ **Canonical IDs**: 44 bills (format: 2026_HB0011, 2026_SF0015, etc.)
✅ **Legacy IDs**: 0 (all reconciled to inactive_at IS NOT NULL)
✅ **Completeness**: true
✅ **No errors**: Orchestrator completes successfully

### Backward Compatibility

✓ 2025 data remains unchanged (all use legacy format HB0011, SF0015, etc.)
✓ 2025 scanning still works (filters by legislative_session not by ID format)
✓ Only new enumerations use composite ID format
✓ Reconciliation is idempotent (safe to run multiple times)

## Implementation Details

### ID Format Decision Tree

```
When inserting LSO bill:
├─ Set id = `${year}_${billNum}` (ALWAYS canonical format)
├─ Set legislative_session = year
└─ On INSERT conflict, update existing record (same composite ID)

After enumeration:
├─ Reconcile step marks inactive any legacy rows where:
│  ├─ id NOT LIKE 'YYYY_%' (legacy format)
│  ├─ legislative_session = year
│  ├─ source = 'lso'
│  └─ Canonical row exists for same bill_number
└─ Return legacy_duplicate_count for diagnostics
```

### Query Examples

**Count canonical IDs** (used for completeness check):
```sql
SELECT COUNT(*) FROM civic_items
WHERE legislative_session = '2026' AND id LIKE '2026_%' AND inactive_at IS NULL;
```

**Mark legacy rows inactive**:
```sql
UPDATE civic_items
SET inactive_at = datetime('now'), updated_at = datetime('now')
WHERE legislative_session = '2026'
  AND source = 'lso'
  AND id NOT LIKE '2026_%'
  AND inactive_at IS NULL
  AND EXISTS (
    SELECT 1 FROM civic_items ci
    WHERE ci.legislative_session = '2026'
      AND ci.bill_number = civic_items.bill_number
      AND ci.id LIKE '2026_%'
  );
```

## Notes

- **Idempotent**: Running enumeration multiple times is safe (0 new bills after first run)
- **Atomic**: Reconciliation happens in same transaction as enumeration
- **No schema changes**: Uses existing `id`, `inactive_at`, and `legislative_session` columns
- **No data loss**: Legacy rows marked inactive, not deleted
- **Diagnostic**: `db_total_legacy_duplicates_year` helps identify partial reconciliation issues
