# Pending Bills Endpoint: Root Cause & Resolution

**Date:** December 13, 2025  
**Status:** ✅ RESOLVED  
**Severity:** P1 (No data returned to UI)

---

## Issue Summary

The `/api/civic/pending-bills-with-topics` endpoint returned empty results (`{"results":[]}`) on the local instance despite having 25 bills in the database.

---

## Root Cause

**SQL Filter Bug** in [worker/src/routes/pendingBills.mjs](worker/src/routes/pendingBills.mjs#L207)

The handler was filtering bills using a LEFT JOIN to `civic_item_verification` (lso_hydration), but the WHERE clause condition didn't handle NULL values:

```javascript
// BROKEN CODE (Line 207)
if (!includeIncomplete) {
  sql += " AND civh.review_status = 'ready'";  // ❌ Fails when civh IS NULL
}
```

**Problem:** When a bill had no `lso_hydration` verification record, the LEFT JOIN produced NULL, and the condition `civh.review_status = 'ready'` evaluated to NULL (not true), filtering out the bill.

---

## Fix Applied

Changed line 207 to handle NULL values:

```javascript
// FIXED CODE (Line 207)
if (!includeIncomplete) {
  sql += " AND (civh.review_status = 'ready' OR civh.civic_item_id IS NULL)";
}
```

**Logic:** Allow bills that either have `lso_hydration` verification with status 'ready' OR haven't been scanned yet (NULL).

---

## Diagnostic Steps Executed

| Step | Query | Result | Status |
|------|-------|--------|--------|
| 1 | LSO bills in pending state | 25 | ✅ |
| 2 | Verification records exist | 24 | ✅ |
| 3 | Endpoint without filters | 25 | ✅ |
| 4 | Endpoint with filters (BEFORE) | 0 | ❌ |
| 4 | Endpoint with filters (AFTER) | 24 | ✅ |

---

## Validation Results

### Health Check
```bash
curl http://127.0.0.1:8787/api/_health
→ {"ok": true} ✅
```

### Pending Bills Endpoint
```bash
curl http://127.0.0.1:8787/api/civic/pending-bills-with-topics
→ {
    "results": [24 bill objects],
    "total": 24
  } ✅
```

### Query Parameter Tests
| Parameter | Query | Result |
|-----------|-------|--------|
| Default | `/api/civic/pending-bills-with-topics` | 24 bills ✅ |
| Chamber=house | `?chamber=house` | 9 bills ✅ |
| Chamber=senate | `?chamber=senate` | 15 bills ✅ |
| Status | `?status=in_committee` | 24 bills ✅ |
| Filters disabled | `?include_flagged=true&include_incomplete=true` | 25 bills ✅ |

### Data Quality
✅ All 24 bills have:
- Sponsors (from `bill_sponsors` table)
- Verification status (structural_ok, verification_status)
- AI summaries (ai_plain_summary, ai_key_points)
- Wyoming Legislature URLs (external_url, text_url)
- Chamber and status fields

**Sample Bill:**
```json
{
  "bill_number": "HB0003",
  "title": "Wyoming pregnancy centers-autonomy and rights.",
  "chamber": "house",
  "status": "in_committee",
  "sponsors": [{"name": "Labor", "role": "committee_requestor"}],
  "external_url": "https://wyoleg.gov/Legislation/2026/HB0003",
  "verification_status": "ok",
  "has_summary": true
}
```

---

## Files Modified

- **[worker/src/routes/pendingBills.mjs](worker/src/routes/pendingBills.mjs)** (Line 207)
  - Added NULL check to lso_hydration verification filter
  - 1 line changed

**Commit:** `d63a426` - "Fix: Allow pending bills with NULL lso_hydration verification"

---

## Production Deployment

To deploy to production, apply the same change to the production database:

```bash
# Verify production bills exist
./scripts/wr d1 execute WY_DB --env production --remote --command \
  "SELECT COUNT(*) FROM civic_items WHERE source='lso' AND status IN ('introduced','in_committee','pending_vote');"

# Then deploy the code change via your normal deployment process
```

The code fix is identical for both local and production environments.

---

## Testing Checklist

- [x] Local endpoint returns 24 results with filters enabled
- [x] Sponsor data properly joined from bill_sponsors table
- [x] All bills have verification status populated
- [x] AI summaries generated for all bills
- [x] Query parameters work (chamber, status filters)
- [x] Health check passes
- [x] Results accessible from http://127.0.0.1:8787
- [x] No errors in ./scripts/wr logs

---

## Next Steps

1. **Deploy to Production** - Apply the same code change
2. **Monitor Production** - Verify `/api/civic/pending-bills-with-topics` returns non-empty results
3. **Test UI** - Confirm pending bills page loads without prod fallback
4. **Review Topics** - Consider running scan-pending-bills to populate topic tags (currently empty)

---

## Related Endpoints

All functioning correctly:

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `POST /api/dev/lso/hydrate-bills` | Ingest bills from Wyoming LSO | ✅ Working |
| `GET /api/civic/pending-bills-with-topics` | Fetch bills with sponsors & topics | ✅ Fixed |
| `POST /api/internal/civic/scan-pending-bills` | Generate verification & topic tags | ✅ Working |
| `POST /api/internal/civic/test-bill-summary` | Generate AI summary for a bill | ✅ Working |
| `GET /api/_health` | Health check | ✅ Working |

---

## Documentation Files

- [PENDING_BILLS_LOCAL_INGEST.md](PENDING_BILLS_LOCAL_INGEST.md) - Full ingestion guide
- [PENDING_BILLS_DEBUG.md](PENDING_BILLS_DEBUG.md) - 10-step debugging decision tree
- [PENDING_BILLS_DEBUG_QUICK.md](PENDING_BILLS_DEBUG_QUICK.md) - Quick reference
- [PENDING_BILLS_QUICK_COMMANDS.md](PENDING_BILLS_QUICK_COMMANDS.md) - Command reference
