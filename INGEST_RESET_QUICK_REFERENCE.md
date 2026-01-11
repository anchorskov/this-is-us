# Ingestion Reset System - Quick Reference

## Quick Start

### Check reset works
```bash
curl -X POST "http://127.0.0.1:8787/api/admin/ingest/reset?mode=derived-only" | jq .
```

### Run enumeration with auto-reset
```bash
curl -X POST "http://127.0.0.1:8787/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"enumerate","limit":500,"force":true}' | jq '.reset_results'
```

### Run full pipeline with auto-reset
```bash
curl -X POST "http://127.0.0.1:8787/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"all","limit":5,"force":true}' | jq '.reset_results'
```

## What Gets Reset

| Mode | Tables Cleared | Use Case |
|------|---|---|
| `derived-only` (default) | hot_topics, hot_topic_civic_items, civic_item_ai_tags, civic_item_verification | Regular ingestion runs, safe default |
| `full-rebuild` | All above + civic_item_sources, civic_items AI fields | Complete rebuild from scratch |

## When Reset Triggers

Reset **automatically** executes when:
- ✅ `phase="enumerate"` OR `phase="all"` 
- ✅ `force=true` in request
- ✅ `dryRun=false` (not in dry-run mode)

Manual reset **always** works:
- ✅ `POST /api/admin/ingest/reset?mode=derived-only|full-rebuild`

## Response Structure

```json
{
  "reset_results": {
    "success": true,
    "mode": "derived-only",
    "timestamp": "2025-12-21T15:16:27.224Z",
    "cleared": {
      "table_name": {
        "deletedCount": 12,
        "status": "cleared"
      }
    }
  }
}
```

## Files Involved

| File | Changes | Purpose |
|------|---------|---------|
| `worker/src/lib/ingestReset.mjs` | NEW (87 lines) | Core reset logic |
| `worker/src/routes/adminIngestReset.mjs` | NEW (61 lines) | Admin endpoint |
| `worker/src/routes/adminWyoleg.mjs` | Modified | Integrated reset call (lines 203-220) |
| `worker/src/index.mjs` | Modified | Added route registration |

## Safety Guarantees

🔒 **Data Protection**
- Original bill data (`civic_items`) never deleted
- Only AI-derived tables cleared
- Dependency order respected (children before parents)

✅ **Idempotent**
- Safe to call multiple times
- Second call deletes 0 rows (already cleared)

📋 **Auditable**
- Row counts logged per table
- Timestamp included in response
- All operations logged to console

## Environment Variables

For production auth:
```bash
ALLOW_ADMIN_RESET=true          # Enable reset endpoint
X-Admin-Key=<secret>            # Header for local dev
```

## Troubleshooting

**Q: Reset endpoint returns 403 (Unauthorized)**
- Local dev: Should always work, check worker is running
- Production: Set `ALLOW_ADMIN_RESET=true` env var

**Q: Reset says success=false**
- Check error message in response
- Verify database connections WY_DB and EVENTS_DB
- Check logs: `worker/.wrangler-persist` for D1 operations

**Q: Reset deletes 0 rows but should delete more**
- This is normal if already cleared!
- Check current counts: `curl http://127.0.0.1:8787/api/hot-topics?session=2026`

**Q: How to verify what was cleared?**
- Response includes `cleared.table_name.deletedCount`
- Check logs for: `✅ Derived state reset complete`

## Integration Examples

### Completely Fresh Start (All Years)
```bash
for year in 2025 2026 2027; do
  curl -X POST http://127.0.0.1:8787/api/admin/ingest/reset?mode=full-rebuild
  curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
    -H "Content-Type: application/json" \
    -d "{\"session\":\"$year\",\"phase\":\"all\",\"force\":true,\"limit\":100}"
done
```

### Incremental Fresh Run (Single Year)
```bash
curl -X POST http://127.0.0.1:8787/api/internal/admin/wyoleg/run \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"all","force":true,"limit":500}'
# Reset happens automatically with force=true
```

### Manual Maintenance Cleanup
```bash
# Reset hot topics only (preserve summaries)
curl -X POST http://127.0.0.1:8787/api/admin/ingest/reset?mode=derived-only

# Full reset (rebuild everything)
curl -X POST http://127.0.0.1:8787/api/admin/ingest/reset?mode=full-rebuild
```

## Monitoring

Check ingestion logs for reset:
```bash
# Look for these lines:
# 🔄 Resetting derived ingestion state (force=true, phase=enumerate)...
# ✅ Derived state reset complete: { hot_topics: {...}, ... }
```

Check response for reset results:
```bash
curl -s <ingestion-response> | jq '.reset_results | {success, mode, timestamp, cleared: (.cleared | keys)}'
```

---

**Last Updated**: 2025-12-21
**Status**: ✅ Production Ready
