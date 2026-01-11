# Route Changes – civicScan.mjs Modifications

**File:** `worker/src/routes/civicScan.mjs`  
**Date:** December 15, 2025  
**Change Type:** Feature Addition (resolveOnly parameter)

## Summary

Added support for `?resolveOnly=1` query parameter to the `/api/internal/civic/scan-pending-bills` endpoint. This allows testing PDF resolution without calling OpenAI, reducing costs and enabling faster iteration.

## Changes Made

### 1. Function Signature Update

```javascript
// BEFORE
async function scanPendingBillsInternal(
  env,
  { batchSize = BATCH_SIZE, force = false, maxAgeDays = MAX_AGE_DAYS } = {}
)

// AFTER
async function scanPendingBillsInternal(
  env,
  { batchSize = BATCH_SIZE, force = false, maxAgeDays = MAX_AGE_DAYS, resolveOnly = false } = {}
)
```

### 2. Conditional Logic Addition

Added early-exit logic when `resolveOnly=true`:

```javascript
// If resolveOnly=true, skip summaries and topic analysis
if (resolveOnly) {
  results.push({
    bill_id: bill.id,
    bill_number: bill.bill_number,
    resolved: !!cachedSource?.best_doc_url,
    summary_generated: false,
    topics: [],
  });
  continue;  // Skip to next bill, don't call OpenAI
}
```

### 3. Response Field Addition

Added new fields to response:

```javascript
return {
  scanned: results.length,
  saved_tags: savedTags,
  sources_resolved: resolvedCount,      // NEW
  resolve_only: resolveOnly,             // NEW
  results,
  timestamp: new Date().toISOString(),
};
```

### 4. Handler Parameter Parsing

Updated `handleScanPendingBills()` to parse and pass the parameter:

```javascript
// BEFORE
const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";

// AFTER
const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";
const resolveOnly = url.searchParams.get("resolveOnly") === "1" || url.searchParams.get("resolveOnly") === "true";

// ... and pass it to scanPendingBillsInternal
const result = await scanPendingBillsInternal(env, {
  batchSize: BATCH_SIZE,
  force,
  resolveOnly,  // NEW
});
```

### 5. Logging Improvements

Enhanced logging to show resolve-only mode:

```javascript
// Console logs
console.log("🚀 Starting pending bill scan...", 
  JSON.stringify({ batchSize, force, maxAgeDays, resolveOnly }));

// Result logs
const logMsg = resolveOnly 
  ? `✅ Resolve-only complete: ${results.length} bills processed, ${resolvedCount} new sources resolved`
  : `✅ Scan complete: ${results.length} bills processed, ${savedTags} topic tags saved`;
```

## API Usage

### Resolve Only (No OpenAI Cost)

```bash
curl -X POST \
  http://127.0.0.1:8787/api/internal/civic/scan-pending-bills?resolveOnly=1 \
  -H "X-Internal-Token: test"
```

**Response:**
```json
{
  "scanned": 25,
  "saved_tags": 0,
  "sources_resolved": 18,
  "resolve_only": true,
  "results": [
    {
      "bill_id": "...",
      "bill_number": "SF0013",
      "resolved": true,
      "summary_generated": false,
      "topics": []
    }
  ],
  "timestamp": "2025-12-15T..."
}
```

### Full Scan (Existing Behavior)

```bash
curl -X POST \
  http://127.0.0.1:8787/api/internal/civic/scan-pending-bills?force=1 \
  -H "X-Internal-Token: test"
```

### Combined (Resolve + Force Scan)

```bash
curl -X POST \
  http://127.0.0.1:8787/api/internal/civic/scan-pending-bills?resolveOnly=1&force=1 \
  -H "X-Internal-Token: test"
```

## Backward Compatibility

✅ **Fully backward compatible**
- Default value is `resolveOnly=false`
- Existing calls without parameter work unchanged
- All existing tests pass
- No breaking changes to response schema (only additions)

## Benefits

| Benefit | Impact |
|---------|--------|
| **Cost Reduction** | Skip OpenAI calls, save ~$0.05 per test |
| **Speed** | PDF resolution in seconds vs minutes |
| **Debugging** | Isolate PDF resolver from AI pipeline |
| **Testing** | Can run frequently in CI without quota concerns |
| **Flexibility** | Use as smoke test or integration test |

## Testing

Test this feature with:

```bash
# From worker directory
./scripts/test-wyoleg-pipeline-local.sh --reset
```

The test runner will:
1. Call `?resolveOnly=1` to populate `civic_item_sources`
2. Extract PDF text via Python
3. Call `?force=1` to tag bills
4. Verify results with SQL checks

## Related Code

- **Handler:** `handleScanPendingBills()` in civicScan.mjs
- **Core Logic:** `scanPendingBillsInternal()` in civicScan.mjs
- **PDF Resolver:** `resolveDocument()` in lib/docResolver/
- **Test Suite:** `scripts/test-wyoleg-pipeline-local.sh`
- **SQL Verification:** `scripts/sql/check-wyoleg-health.sql`

---

**Status:** ✅ Complete & Tested  
**Version:** 1.0  
**Backward Compatible:** Yes
