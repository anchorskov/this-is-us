# Composite ID Fix - Complete Resolution

## Problem Identified
The orchestrator's scan phase was returning `scan_candidate_count=0` for 2026 despite 44 bills being enumerated. Root cause: **PRIMARY KEY collision** on bill IDs across sessions.

### Technical Details
- **Civic Items Table**: PRIMARY KEY is `id TEXT` (e.g., "HB0002")
- **Issue**: Same bill number (e.g., HB0002) exists in both 2025 and 2026 sessions
- **Conflict**: `ON CONFLICT(id)` silently updated 2025 row instead of creating 2026 row
- **Result**: Enumeration reported 44 new bills but 0 were actually saved for 2026

## Solutions Implemented

### 1. Composite ID Format ✅
**File**: [worker/src/lib/wyLsoEnumerate.mjs](worker/src/lib/wyLsoEnumerate.mjs#L38-L41)
- Changed enumeration to use `${year}_${billNum}` format
- Example: "2026_HB0002" instead of "HB0002"
- Allows same bill number in different sessions without PRIMARY KEY conflicts

```javascript
// NEW: Composite ID prevents cross-session collisions
const compositeId = `${year}_${billNum}`;
// All inserts now use compositeId instead of raw billNum
```

### 2. Scan Phase Support ✅
**File**: [worker/src/routes/adminWyoleg.mjs](worker/src/routes/adminWyoleg.mjs#L245)
- Added support for `phase: "scan"` (previously only handled "scan_ai" and "resolve_docs")
- Now correctly captures `scan_candidate_count` from scan response

### 3. Active Bills Tracking ✅
**File**: [worker/src/routes/adminWyoleg.mjs](worker/src/routes/adminWyoleg.mjs#L282-L285)
- Added query to count active (non-inactive) bills per year
- Correctly populates `db_total_active_bills_year` during both enumerate and scan phases

### 4. Pending Bill Status Fix ✅
**File**: [worker/src/routes/civicScan.mjs](worker/src/routes/civicScan.mjs#L32)
- Updated PENDING_STATUSES to include "draft_committee"
- LSO-enumerated bills start in draft_committee status
- Scan now correctly identifies them as candidates

## Verification Results

### 2026 Full E2E Test (Enumerate + Scan)
```
Enumeration:
  - LSO Service found: 44 bills
  - Bills in database: 44 (2026)
  - Active bills: 44

Scanning:
  - Candidates identified: 37 bills
  - Bills scanned: 37 bills
  - Completeness: TRUE ✅
  - Errors: 0
```

### 2025 Regression Test (No New Bills Expected)
```
Scanning:
  - Candidates identified: 500 bills
  - Bills scanned: 500 bills
  - Active bills in year: 536
  - No regression detected ✅
```

### Database State Verification
```sql
SELECT COUNT(*) as bills_2026, legislative_session FROM civic_items 
GROUP BY legislative_session ORDER BY legislative_session DESC;

Results:
  2026: 44 bills ✅
  2025: 555 bills ✅
```

## Files Modified

1. **wyLsoEnumerate.mjs** (lines 38-102)
   - Composite ID generation and insertion
   - Impact: 2026+ enumerations create year-scoped IDs

2. **adminWyoleg.mjs** (lines 245, 282-285)
   - Added "scan" phase support
   - Added active bills counting query
   - Impact: Orchestrator correctly reports metrics for all phases

3. **civicScan.mjs** (line 32)
   - Updated PENDING_STATUSES to include "draft_committee"
   - Impact: Newly enumerated bills are now scannable

## Test Commands

**Run enumeration for 2026:**
```bash
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"enumerate","limit":500,"force":true}'
```

**Run scan for 2026:**
```bash
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"scan","limit":500}'
```

**Run full E2E for 2026:**
```bash
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"all","limit":500}'
```

**Check database state:**
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 execute WY_DB --local --persist-to ./../scripts/wr-persist --command \
  "SELECT COUNT(*) as bills_2026 FROM civic_items WHERE legislative_session='2026';"
```

## Impact Summary

✅ **Composite ID Fix**: Bills for different years can coexist without PRIMARY KEY conflicts
✅ **Scan Phase**: Orchestrator correctly identifies and processes candidates
✅ **Status Support**: Newly enumerated bills in draft_committee status are scannable
✅ **No Regression**: 2025 data remains fully functional
✅ **End-to-End**: Full pipeline works for 2026 (enumerate → scan → complete)

## Breaking Changes
None - all changes are backward compatible. 2025 bills continue to use original IDs (HB0002, etc.) and work as before. Only new enumerations (2026+) use the composite ID format.
