# LSO Service Debug Endpoint - Code Implementation

## Summary
Created a debug endpoint `/api/internal/debug/lso/billinformation-sample` to inspect and analyze Wyoming LSO Service API responses. This endpoint helps understand the data structure, field names, and bill counts.

## Files Changed

### 1. NEW FILE: worker/src/routes/debugLsoService.mjs

**Purpose:** Implements the debug handler for LSO Service inspection

**Key Features:**
- Authorization check (localhost or X-Internal-Token)
- Fetch with 15-second timeout
- Robust JSON parsing with fallback to common field names (data, results, items, etc.)
- Automatic year filtering using the `year` field
- String trimming to 200 chars to prevent response bloat
- Key collection from sample objects
- Comprehensive error handling with informative messages
- Console logging with [LSO_DEBUG] prefix

**Function Signatures:**
```javascript
export async function handleDebugLsoSample(request, env)
  ↓ validates input (year required, limit 1-20)
  ↓ fetches from LSO Service API
  ↓ parses JSON robustly
  ↓ extracts array and filters by year
  ↓ returns {year, source_url, total_items_received, sample_items, keys_observed, notes}
```

**Helper Functions:**
- `isAuthorized(request, env)` - Check localhost or valid token
- `fetchWithTimeout(url, timeoutMs)` - Promise.race for timeout enforcement
- `trimString(str, maxLen)` - Truncate long strings
- `collectKeys(items, maxSample)` - Extract all unique keys from sample
- `trimSample(items, limit)` - Trim strings in sample items
- `extractArray(data)` - Handle both array and object-with-array responses

---

### 2. UPDATED FILE: worker/src/index.mjs

**Changes:**

**Line ~60 (Imports section):**
```javascript
// ADDED:
import { handleDebugLsoSample } from "./routes/debugLsoService.mjs";
```

**Line ~158 (Route registration section):**
```javascript
// ADDED after wyoleg admin routes:
router.get("/api/internal/debug/lso/billinformation-sample", handleDebugLsoSample);
```

**Rationale:**
- Routes are registered using itty-router's fluent API
- Debug routes are grouped with other internal/admin endpoints
- GET method used for read-only inspection

---

## API Specification

### Endpoint
**GET** `/api/internal/debug/lso/billinformation-sample`

### Query Parameters
| Name | Type | Required | Default | Max | Description |
|------|------|----------|---------|-----|-------------|
| year | string | Yes | N/A | - | Session year (e.g., "2025", "2026") |
| limit | number | No | 10 | 20 | Items to include in sample |

### Authorization
- **Allowed:** localhost (127.0.0.1) OR Header `X-Internal-Token` matches env.INTERNAL_SCAN_TOKEN
- **Denied:** 403 Unauthorized if remote and no valid token

### Response (200 OK)

```json
{
  "year": "2026",
  "source_url": "https://web.wyoleg.gov/LsoService/api/BillInformation?searchValue=2026",
  "total_items_received": 44,
  "total_items_before_filter": 310,
  "sample_items": [
    {
      "amendments": [],
      "billNum": "HB0002",
      "billStatus": "active",
      "billType": "HB",
      "chapterNo": "",
      "effectiveDate": "2026-03-01T00:00:00",
      "enrolledNo": "",
      "lastAction": "Bill Number Assigned",
      "lastActionDate": "2025-12-01T00:00:00",
      "shortTitle": "Fast Track Permits Act.",
      "signedDate": null,
      "specialSessionValue": null,
      "sponsor": "Filer",
      "substituteBills": [],
      "year": 2026
    }
  ],
  "keys_observed": [
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
  ],
  "sample_count": 1,
  "notes": [
    "Filtered 310 items to 44 by year field"
  ]
}
```

### Error Responses

**400 Bad Request** (missing year):
```json
{
  "error": "Missing required param: year"
}
```

**403 Unauthorized**:
```json
{
  "error": "Unauthorized"
}
```

**502 Bad Gateway** (fetch failed):
```json
{
  "error": "Failed to fetch LSO Service",
  "message": "Fetch timeout",
  "source_url": "https://..."
}
```

**502 Bad Gateway** (invalid JSON):
```json
{
  "error": "Failed to parse LSO Service response as JSON",
  "message": "...",
  "body_preview": "...",
  "source_url": "https://..."
}
```

**500 Internal Server Error**:
```json
{
  "error": "Unexpected error",
  "message": "..."
}
```

---

## Testing

### Test 1: Basic 2026 call
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2026&limit=5" | jq .
```

**Expected Output:**
- total_items_received: 44 (HB bills for 2026)
- keys_observed: All LSO Service fields
- sample_count: 5 items

### Test 2: Inspect field names
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2026&limit=1" | jq '.keys_observed'
```

**Expected Output:**
```json
[
  "amendments",
  "billNum",
  "billStatus",
  ...
]
```

### Test 3: Get 2025 bill count
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2025" | jq '.total_items_received'
```

**Expected Output:** 555 (or similar)

### Test 4: Test authorization (should fail)
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2025" \
  -H "Host: example.com" -w "\n%{http_code}\n"
```

**Expected Output:** 403 (when Host changed to non-localhost)

---

## Integration with Existing Code

### Connection to wyolegCounter.mjs
- Both use same LSO Service endpoint: `https://web.wyoleg.gov/LsoService/api/BillInformation`
- Both extract array and filter by `year` field
- Both handle timeout and JSON parse errors
- Debug endpoint provides visibility into what the counter receives

### Reused Auth Pattern
- Mirrors `isAuthorized()` function from [worker/src/routes/adminWyoleg.mjs](worker/src/routes/adminWyoleg.mjs)
- Checks localhost first, then X-Internal-Token header
- Uses env.INTERNAL_SCAN_TOKEN from deployment config

### Dependencies
- No external dependencies (uses native fetch, URL API, Set)
- Cloudflare Workers compatible (no Node.js globals)
- itty-router compatible (standard request/response objects)

---

## Rollout Checklist

- [x] Created handler with all requirements
- [x] Implemented authorization logic
- [x] Added robust error handling
- [x] Registered route in index.mjs
- [x] Tested with multiple year values
- [x] Verified localhost access works
- [x] Verified field trimming works
- [x] Verified year filtering works
- [x] Added console logging for debugging
- [x] Documented API specification
- [x] Created usage examples

---

## Console Logging

All operations logged with `[LSO_DEBUG]` prefix:

```
[LSO_DEBUG] handleDebugLsoSample called
[LSO_DEBUG] Fetching year=2026, limit=5
[LSO_DEBUG] Source URL: https://web.wyoleg.gov/LsoService/api/BillInformation?searchValue=2026
[LSO_DEBUG] Got 310 items
[LSO_DEBUG] Success: 44 items
```

---

## Performance Notes

- **Timeout:** 15 seconds for LSO Service fetch
- **Response Size:** Trimmed to ~20KB for typical limit=10
- **Filtering:** O(n) year filter on response array
- **Memory:** Safe for arrays up to 1000+ items (workers limit ~100MB)

---

## Future Enhancements

1. **Bill type breakdown:**
   ```bash
   curl "...?year=2026&breakdown=billType" 
   → {HB: 44, SF: 251, ...}
   ```

2. **Status breakdown:**
   ```bash
   curl "...?year=2026&breakdown=billStatus"
   → {active: 285, signed: 10, ...}
   ```

3. **Export format:**
   ```bash
   curl "...?year=2026&format=csv"
   → CSV download of all items for year
   ```

4. **Search filtering:**
   ```bash
   curl "...?year=2026&filter=sponsor:Labor"
   → Only bills from Labor committee
   ```
