# LSO Service Debug Endpoint Summary

## Endpoint Created
**GET** `/api/internal/debug/lso/billinformation-sample`

### Query Parameters
- `year` (required): Session year (e.g., 2025, 2026)
- `limit` (optional): Number of sample items to return (default: 10, max: 20)

### Authorization
- Allowed if localhost (127.0.0.1)
- OR requires `X-Internal-Token` header matching `INTERNAL_SCAN_TOKEN` env var

### Response Fields
- `year`: The requested year
- `source_url`: The actual LSO Service URL called
- `total_items_received`: Number of items after filtering by year field
- `total_items_before_filter`: Raw count from API
- `sample_items`: Array of trimmed sample objects
- `keys_observed`: All unique top-level keys found in items
- `sample_count`: Number of items in sample
- `notes`: Any processing notes (e.g., filtering applied)

### Error Handling
- **400**: Missing required `year` parameter
- **403**: Unauthorized (not localhost, invalid token)
- **502**: LSO Service fetch failed or invalid JSON
- **500**: Unexpected error

---

## Sample Data Findings

### 2026 Session
**Test:**
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2026&limit=5" | jq .
```

**Results:**
- **Total items before filter:** 310
- **Total items after year filter:** 44 (HB/HF bills)
- **Sample billTypes:** HB, HF (House bills)
- **Status:** active
- **Effective date:** 2026-03-01

**Key Fields Available:**
```json
[
  "amendments",
  "billNum",
  "billStatus", 
  "billType",
  "chapterNo",
  "effectiveDate",
  "enrolledNo",
  "lastAction",
  "lastActionDate",
  "shortTitle",
  "signedDate",
  "specialSessionValue",
  "sponsor",
  "substituteBills",
  "year"
]
```

### 2025 Session
**Test:**
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2025&limit=3" | jq '.total_items_received'
```

**Results:**
- **Total items before filter:** 724
- **Total items after year filter:** 555 (active HB/SF bills)

---

## Data Structure Notes

1. **LSO Service API returns all years in one call** - The `searchValue` parameter doesn't filter by year; instead it does a broad search and we must filter in-memory using the `year` field.

2. **Field names match LSO Service exactly:**
   - `billNum`: Bill identifier (e.g., "HB0001", "SF0001")
   - `billType`: "HB" (House), "HF" (House Floor?), "SF" (Senate)
   - `billStatus`: "active", "signed", etc.
   - `year`: Numeric year field

3. **Sample item structure:**
   ```javascript
   {
     "amendments": [],
     "substituteBills": [],
     "year": 2026,
     "billNum": "HB0002",
     "shortTitle": "Fast Track Permits Act. ",
     "chapterNo": "",
     "signedDate": null,
     "effectiveDate": "2026-03-01T00:00:00",
     "sponsor": "Filer",
     "enrolledNo": "",
     "lastActionDate": "2025-12-01T00:00:00",
     "lastAction": "Bill Number Assigned",
     "billType": "HB",
     "specialSessionValue": null,
     "billStatus": "active"
   }
   ```

---

## Files Modified

1. **worker/src/routes/debugLsoService.mjs** (NEW)
   - 290 lines
   - Handles GET /api/internal/debug/lso/billinformation-sample
   - Robust JSON parsing with fallback to array field extraction
   - Automatic year filtering
   - String trimming to prevent response bloat
   - [LSO_DEBUG] console logging throughout

2. **worker/src/index.mjs** (UPDATED)
   - Added import: `import { handleDebugLsoSample } from "./routes/debugLsoService.mjs";`
   - Added route: `router.get("/api/internal/debug/lso/billinformation-sample", handleDebugLsoSample);`

---

## Usage Examples

### Basic call (2026, default 10 items)
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2026" | jq .
```

### Inspect field names
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2025&limit=1" | jq '.keys_observed'
```

### Get sample bills for a year
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2026&limit=5" | jq '.sample_items[].billNum'
```

### With auth token (remote deployment)
```bash
curl -s "https://example.com/api/internal/debug/lso/billinformation-sample?year=2026" \
  -H "X-Internal-Token: your_secret_token" | jq .
```

---

## Integration with wyolegCounter.mjs

The `countBillsViaLsoService()` function in [worker/src/lib/wyolegCounter.mjs](worker/src/lib/wyolegCounter.mjs) uses the same LSO Service API:

1. Calls: `https://web.wyoleg.gov/LsoService/api/BillInformation?searchValue=<year>`
2. Extracts array from response
3. Filters by `year` field to get session-specific bills
4. Extracts `billNum` from each item
5. Returns count as `total_items_received` from debug endpoint

**The 251 count for 2026 in orchestrator output represents SF (Senate) bills, not total HB bills.**

---

## Next Steps for Investigation

To split out HB vs SF bills:
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2026&limit=100" | \
  jq '[.sample_items[] | .billType] | group_by(.) | map({type: .[0], count: length})'
```

This would let us verify the 44 HB + 251 SF = 295 expected bills for 2026.
