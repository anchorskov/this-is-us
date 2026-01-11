# Ingestion Reset System - Implementation Complete ✅

## Summary

The comprehensive ingestion reset system for hot topics has been successfully implemented and tested. This ensures a clean, consistent state before each ingestion run by safely clearing derived tables in the correct dependency order.

## What Was Built

### 1. Core Reset Function (`src/lib/ingestReset.mjs`)
- **resetDerivedState()**: Main reset executor with two modes
  - `derived-only` (default): Clears hot topics and AI-derived tags
  - `full-rebuild`: Also clears summary sources and civic item AI fields
- **validateAdminAuth()**: Security check for admin operations
- Returns detailed row counts per table for audit trail

### 2. Admin Endpoint (`src/routes/adminIngestReset.mjs`)
- **POST /api/admin/ingest/reset**
- Query params: `?mode=derived-only` (default) or `?mode=full-rebuild`
- Header auth: `X-Admin-Key` (dev) or `Authorization: Bearer <token>`
- Returns JSON with cleared row counts and timestamp

### 3. Automatic Integration (Modified `src/routes/adminWyoleg.mjs`)
- Resets derived tables automatically when:
  - `phase === "enumerate"` OR `phase === "all"`
  - `force === true` (explicit reset request)
  - Not in dry-run mode
- Uses safe `derived-only` mode by default
- Logs reset results to response object

### 4. Route Registration (Modified `src/index.mjs`)
- Registered `handleAdminIngestReset` import and route
- Available at `POST /api/admin/ingest/reset`

## Test Results ✅

All tests passed successfully:

```
1. Manual Reset (derived-only mode)
   ✅ cleared: hot_topics, hot_topic_civic_items, civic_item_ai_tags, civic_item_verification
   ✅ row counts returned for audit

2. Manual Reset (full-rebuild mode) 
   ✅ extended clearing: civic_item_sources included
   ✅ all tables reported with row counts

3. Enumeration with Automatic Reset (force=true)
   ✅ reset_results returned in response
   ✅ executed before enumeration begins
   ✅ reset_results.cleared shows per-table counts

4. Full Pipeline with Reset (phase=all, force=true)
   ✅ automatic reset on pipeline start
   ✅ enumeration, scan, and topics all run successfully
   ✅ 6 items scanned, 3 topics created (clean from reset)

5. API Response Structure
   ✅ reset_results object included
   ✅ cleared_tables array shows what was cleared
   ✅ timestamp shows when reset occurred
   ✅ success=true confirms reset worked
```

## Database Safety

**Tables Cleared (safe to clear):**
- `hot_topics` - AI-generated topic index
- `hot_topic_civic_items` - AI relationship mappings
- `civic_item_ai_tags` - AI-generated tags
- `civic_item_verification` - AI verification state
- `civic_item_sources` - Summary source info (full-rebuild only)

**Tables NOT Cleared (canonical data preserved):**
- `civic_items` - Original bill data from Wyoming Legislature
- `bill_sponsors` - Sponsor relationships
- `wy_legislators` - Legislator information
- All voter registry tables

**Dependency Order Maintained:**
```
Delete children before parents:
  hot_topic_civic_items → hot_topics (foreign key relationship)
  civic_item_ai_tags → civic_items (no actual FK, but logical dependency)
```

## How to Use

### Manual Reset (Local Development)
```bash
# Reset hot topics only (default)
curl -X POST "http://127.0.0.1:8787/api/admin/ingest/reset"

# Full rebuild mode (including summaries)
curl -X POST "http://127.0.0.1:8787/api/admin/ingest/reset?mode=full-rebuild"
```

### Automatic Reset During Ingestion
```bash
# Enumerate with automatic reset
curl -X POST "http://127.0.0.1:8787/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"enumerate","limit":500,"force":true}'

# Full pipeline with automatic reset  
curl -X POST "http://127.0.0.1:8787/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"all","limit":5,"force":true}'
```

## Response Format

When reset is triggered automatically (force=true):
```json
{
  "reset_results": {
    "success": true,
    "mode": "derived-only",
    "timestamp": "2025-12-21T15:16:27.224Z",
    "cleared": {
      "hot_topics": {"deletedCount": 12, "status": "cleared"},
      "hot_topic_civic_items": {"deletedCount": 16, "status": "cleared"},
      "civic_item_ai_tags": {"deletedCount": 9, "status": "cleared"},
      "civic_item_verification": {"deletedCount": 0, "status": "cleared"}
    }
  },
  "lso_new_bills_added_this_run": 45,
  "items": [...],
  "errors": []
}
```

## Files Modified/Created

1. **NEW**: `worker/src/lib/ingestReset.mjs` (87 lines)
   - Core reset logic with two modes
   - Admin auth validation
   
2. **NEW**: `worker/src/routes/adminIngestReset.mjs` (61 lines)
   - HTTP endpoint handler
   - CORS-wrapped response
   
3. **MODIFIED**: `worker/src/index.mjs`
   - Added import: handleAdminIngestReset (line 73)
   - Added route: POST /api/admin/ingest/reset (line 159)
   
4. **MODIFIED**: `worker/src/routes/adminWyoleg.mjs`
   - Added import: resetDerivedState (line 7)
   - Added reset call: lines 203-220 (enumeration phase)
   - Added result capture: result.reset_results = resetResult (line 217)

## Key Features

✅ **Two Reset Modes**: Flexible cleanup options (minimal or complete)
✅ **Safe Dependency Order**: Children deleted before parents, no FK violations
✅ **Automatic Integration**: Seamlessly triggers with force=true
✅ **Detailed Logging**: Row counts logged per table for audit trail
✅ **Auth Protection**: X-Admin-Key header validation (production-ready)
✅ **Idempotent**: Safe to call multiple times (deletes 0 rows if already cleared)
✅ **Transparent**: Reset results included in pipeline responses
✅ **Error Handling**: Captures and reports reset failures

## Next Steps

1. Test in staging environment
2. Monitor reset frequency and success rates
3. Consider adding:
   - Transaction wrapper for atomic resets
   - Rollback capability with pre-reset snapshot
   - Session-specific reset filtering
   - Automatic reset scheduling

## Verification Checklist

- [x] Core reset function works (derived-only and full-rebuild modes)
- [x] Admin endpoint callable and returns proper JSON
- [x] Automatic reset triggers with force=true
- [x] Reset results included in pipeline response
- [x] Row counts accurate and reported
- [x] Error handling functional
- [x] Logging shows clear status messages
- [x] Database safety verified (canonical data untouched)
- [x] Auth validation implemented
- [ ] Production deployment and testing

---

**Status**: ✅ Ready for production deployment with staging verification
