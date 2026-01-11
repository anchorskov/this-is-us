# LSO Service Debug Endpoint - Quick Reference Card

## Endpoint URL
```
GET /api/internal/debug/lso/billinformation-sample?year=2026&limit=10
```

## Common Usage

### Get 2026 bills (5 samples)
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2026&limit=5" | jq .
```

### Get 2025 bill count
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2025" | jq '.total_items_received'
```

### Get available field names
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2026&limit=1" | jq '.keys_observed'
```

### Get sample bills (just names)
```bash
curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample?year=2026&limit=10" | jq '.sample_items[].billNum'
```

## Response Structure

```json
{
  "year": "2026",
  "source_url": "https://web.wyoleg.gov/LsoService/api/BillInformation?searchValue=2026",
  "total_items_received": 44,
  "total_items_before_filter": 310,
  "sample_items": [
    {
      "billNum": "HB0002",
      "shortTitle": "Fast Track Permits Act.",
      "billStatus": "active",
      "billType": "HB",
      "sponsor": "Filer",
      "lastAction": "Bill Number Assigned",
      "year": 2026,
      ... (11 more fields)
    }
  ],
  "keys_observed": [
    "amendments", "billNum", "billStatus", "billType", "chapterNo",
    "effectiveDate", "enrolledNo", "lastAction", "lastActionDate",
    "shortTitle", "signedDate", "specialSessionValue", "sponsor",
    "substituteBills", "year"
  ],
  "sample_count": 1,
  "notes": ["Filtered 310 items to 44 by year field"]
}
```

## Query Parameters

| Parameter | Required | Default | Max | Notes |
|-----------|----------|---------|-----|-------|
| year | Yes | - | - | Session year: "2025", "2026", etc. |
| limit | No | 10 | 20 | Number of samples to return |

## Authentication

✅ **Allowed:**
- localhost (127.0.0.1)
- Header: `X-Internal-Token: <INTERNAL_SCAN_TOKEN>`

❌ **Denied:**
- 403 Unauthorized if remote without valid token

## Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Full response with sample items |
| 400 | Bad Request | Missing `year` parameter |
| 403 | Unauthorized | Not localhost + no valid token |
| 502 | Bad Gateway | LSO Service failed or invalid JSON |
| 500 | Server Error | Unexpected error |

## Implementation Files

- **Handler:** [worker/src/routes/debugLsoService.mjs](worker/src/routes/debugLsoService.mjs)
- **Router:** [worker/src/index.mjs](worker/src/index.mjs) (lines 62, 160)
- **Documentation:** LSO_DEBUG_ENDPOINT_*.md files

## Data Insights

### 2025 Session
```
Total Bills: 555 (filtered from 724 items)
Status: Active
Available Fields: 15
```

### 2026 Session
```
HB Bills: 44
SF Bills: ~251 (not yet split)
Total Items: 310 (before filter)
Status: All "Bill Number Assigned"
```

## Field Names Available

All 15 fields returned:
```
amendments (array)
billNum (string) ← primary key
billStatus (string)
billType (string) ← HB, SF, HF, etc.
chapterNo (string)
effectiveDate (datetime)
enrolledNo (string)
lastAction (string)
lastActionDate (datetime)
shortTitle (string)
signedDate (datetime or null)
specialSessionValue (string or null)
sponsor (string)
substituteBills (array)
year (number) ← filtered on this
```

## Console Logging

Look for `[LSO_DEBUG]` prefix in logs:
```
[LSO_DEBUG] handleDebugLsoSample called
[LSO_DEBUG] Fetching year=2026, limit=5
[LSO_DEBUG] Source URL: https://...
[LSO_DEBUG] Got 310 items
[LSO_DEBUG] Success: 44 items
```

## Error Examples

### Missing year
```bash
$ curl -s "http://127.0.0.1:8787/api/internal/debug/lso/billinformation-sample" | jq .
{"error": "Missing required param: year"}
```

### Unauthorized (from remote)
```bash
$ curl -s "https://example.com/.../billinformation-sample?year=2026" | jq .
{"error": "Unauthorized"}
```

### LSO Service down
```bash
$ curl -s ".../billinformation-sample?year=2026" | jq .
{
  "error": "Failed to fetch LSO Service",
  "message": "Fetch timeout",
  "source_url": "https://..."
}
```

## Troubleshooting

**Q: Getting 403 Unauthorized on remote**  
A: Set the `X-Internal-Token` header to match `INTERNAL_SCAN_TOKEN` env var

**Q: Getting 400 on request**  
A: Make sure `year` query parameter is present

**Q: Getting 502 Bad Gateway**  
A: LSO Service API is down or returning invalid JSON. Check source_url.

**Q: Limit not working**  
A: Limit is capped to max 20 and defaults to 10

**Q: Want to split HB vs SF bills**  
A: Use jq to filter: `.sample_items[] | select(.billType=="HB")`

## Integration Points

- **wyolegCounter.mjs** - Uses same LSO Service API and year filtering
- **adminWyoleg.mjs** - Orchestrator that calls counter
- **Authorization pattern** - Mirrors existing internal endpoints

## See Also

- [LSO_DEBUG_ENDPOINT_SUMMARY.md](LSO_DEBUG_ENDPOINT_SUMMARY.md)
- [LSO_DEBUG_ENDPOINT_IMPLEMENTATION.md](LSO_DEBUG_ENDPOINT_IMPLEMENTATION.md)
- [LSO_DEBUG_ENDPOINT_CODE_DIFF.md](LSO_DEBUG_ENDPOINT_CODE_DIFF.md)
- [LSO_DEBUG_ENDPOINT_COMPLETE.md](LSO_DEBUG_ENDPOINT_COMPLETE.md)
