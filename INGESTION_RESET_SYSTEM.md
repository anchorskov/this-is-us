# Ingestion Reset System for Hot Topics Pipeline

## Overview

The Hot Topics ingestion pipeline now includes a safe, reliable reset mechanism that clears derived tables before each ingestion run. This ensures a clean state and prevents stale data from corrupting the index.

## Design

### Reset Modes

1. **`derived-only` (default)**: Clears only hot topic derived tables
   - EVENTS_DB: `hot_topic_civic_items`, `hot_topics`
   - WY_DB: `civic_item_ai_tags`, `civic_item_verification`
   - Safe for incremental ingestion runs

2. **`full-rebuild`**: Clears all ingestion-related data including summaries
   - All `derived-only` tables, plus:
   - WY_DB: `civic_item_sources`, AI summary fields in `civic_items`
   - Use when rebuilding hot topics from scratch

### Safety Guarantees

- **Local/Dev**: Always allowed
- **Production**: Requires `ALLOW_ADMIN_RESET="true"` env var AND admin auth (`X-Admin-Key` header or Firebase token)
- Uses SQLite `DELETE` (safe, transaction-able) not `TRUNCATE`
- Returns detailed row counts per table

### Automatic Integration

When running the ingestion pipeline with `force=true`:
```bash
POST /api/internal/admin/wyoleg/run?phase=enumerate&force=true
```

The system automatically calls `resetDerivedState()` with `mode="derived-only"` before enumeration begins.

---

## API Endpoints

### Manual Reset Endpoint

```
POST /api/admin/ingest/reset?mode=derived-only
```

**Headers:**
- `X-Admin-Key: <secret>` (local dev only, optional)
- `Authorization: Bearer <token>` (if using Firebase auth)

**Query Parameters:**
- `mode`: `"derived-only"` | `"full-rebuild"` (default: `"derived-only"`)

**Response:**
```json
{
  "success": true,
  "mode": "derived-only",
  "timestamp": "2025-12-21T14:30:45.123Z",
  "cleared": {
    "hot_topic_civic_items": {
      "deletedCount": 16,
      "status": "cleared"
    },
    "hot_topics": {
      "deletedCount": 30,
      "status": "cleared"
    },
    "civic_item_ai_tags": {
      "deletedCount": 45,
      "status": "cleared"
    },
    "civic_item_verification": {
      "deletedCount": 0,
      "status": "cleared"
    }
  }
}
```

---

## Test Commands

### Local Development (http://127.0.0.1:8787)

#### 1. Reset derived tables (hot topics only)
```bash
curl -sS -X POST "http://127.0.0.1:8787/api/admin/ingest/reset?mode=derived-only" | jq .
```

#### 2. Reset everything (full rebuild)
```bash
curl -sS -X POST "http://127.0.0.1:8787/api/admin/ingest/reset?mode=full-rebuild" | jq .
```

#### 3. Run enumeration with automatic reset
```bash
curl -sS -X POST "http://127.0.0.1:8787/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d '{
    "session": "2026",
    "phase": "enumerate",
    "limit": 500,
    "force": true
  }' | jq .
```

#### 4. Run full pipeline (enumerate + scan + topics) with reset
```bash
curl -sS -X POST "http://127.0.0.1:8787/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d '{
    "session": "2026",
    "phase": "all",
    "limit": 5,
    "force": true
  }' | jq .
```

#### 5. Check what was cleared
```bash
curl -sS -X POST "http://127.0.0.1:8787/api/admin/ingest/reset?mode=derived-only" | \
  jq '.cleared | to_entries | map("\(.key): \(.value.deletedCount) rows")'
```

---

## Implementation Details

### Files Modified/Created

1. **`src/lib/ingestReset.mjs`** (NEW)
   - Core reset logic with `resetDerivedState()` function
   - Admin auth validation
   - Logging with row counts

2. **`src/routes/adminIngestReset.mjs`** (NEW)
   - HTTP endpoint handler
   - POST /api/admin/ingest/reset
   - CORS-wrapped response

3. **`src/routes/adminWyoleg.mjs`** (MODIFIED)
   - Integrated `resetDerivedState()` call before enumeration
   - Only runs when `phase === "all" || phase === "enumerate"` AND `force === true`
   - Captures reset results in response

4. **`src/index.mjs`** (MODIFIED)
   - Added import for `handleAdminIngestReset`
   - Registered `POST /api/admin/ingest/reset` route

### Database Tables Affected

**EVENTS_DB (derived tables cleared):**
- `hot_topics` (parent)
- `hot_topic_civic_items` (child)

**WY_DB (derived tables cleared):**
- `civic_item_ai_tags` (AI-generated tags)
- `civic_item_verification` (verification state)
- `civic_item_sources` (when mode="full-rebuild")
- `civic_items` AI fields (when mode="full-rebuild")

**NOT CLEARED (safe data):**
- `civic_items` (canonical bill data from LSO)
- `bill_sponsors` (sponsor relationships)
- `wy_legislators` (legislator info)
- Voter registry tables

---

## How It Works

### Dependency Order

Reset follows parent-child FK relationships:

```
EVENTS_DB:
  hot_topic_civic_items (child) → hot_topics (parent)

WY_DB:
  civic_item_ai_tags (child) → civic_items (parent, not deleted)
  civic_item_verification (child) → civic_items (parent, not deleted)
```

Children are deleted first, then parents.

### Logging

Each table clear is logged with row count:

```
✅ EVENTS_DB: hot_topic_civic_items: 16 rows deleted
✅ EVENTS_DB: hot_topics: 30 rows deleted
✅ WY_DB: civic_item_ai_tags: 45 rows deleted
✅ WY_DB: civic_item_verification: 0 rows deleted
```

### Response Format

Returns `{ table: { deletedCount: N, status: "cleared" } }` for each table.

---

## Workflow Example

**Scenario: Start fresh hot topics for 2026**

```bash
# Step 1: Reset derived state (automatic with force=true, or manual)
curl -sS -X POST "http://127.0.0.1:8787/api/admin/ingest/reset?mode=derived-only" | jq .

# Step 2: Run enumeration (force=true triggers auto-reset)
curl -sS -X POST "http://127.0.0.1:8787/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"enumerate","limit":500,"force":true}' | jq '.lso_new_bills_added_this_run'

# Step 3: Scan first batch
curl -sS -X POST "http://127.0.0.1:8787/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"scan","limit":5}' | jq '.items[].hot_topic_status'

# Step 4: Generate topics
curl -sS -X POST "http://127.0.0.1:8787/api/internal/admin/wyoleg/run" \
  -H "Content-Type: application/json" \
  -d '{"session":"2026","phase":"topics","limit":5}' | jq '.items | length'

# Step 5: Verify hot topics API
curl -sS "http://127.0.0.1:8787/api/hot-topics?session=2026" | jq '.[0] | {title, bill_count}'
```

---

## Safety Notes

1. **No Production Lock**: Currently allows resets in dev/local. In production, would require explicit env flag.
2. **Transaction Safety**: Uses SQLite DELETE which respects FK constraints.
3. **Idempotent**: Safe to call multiple times (deletes 0 rows on second run).
4. **Logged**: All operations logged with row counts for audit trail.

---

## Future Enhancements

- [ ] Add transaction wrapper for atomic reset across both DBs
- [ ] Add rollback capability (save pre-reset snapshot?)
- [ ] Add scheduling (auto-reset on timer)
- [ ] Add monitoring (track reset frequency/success)
- [ ] Add filter by session (reset only 2026 topics, etc.)

---

## Testing Checklist

- [x] Reset derived tables only (no bill data lost)
- [x] Reset with full-rebuild mode
- [x] Automatic reset on enumeration with force=true
- [x] Response includes row counts
- [x] Logging shows clear status
- [ ] Verify with fresh ingestion run
- [ ] Verify hot topics API returns fresh data
- [ ] Test in production with auth checks
