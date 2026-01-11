# Hot Topics "0 Bills" Count - Complete Diagnostic Package

## Executive Summary

The Hot Topics page shows "0 bills" on each topic card despite data being populated to the database. This diagnostic package includes:

1. ✅ **Code Analysis** - Identified the exact field names and flow
2. ✅ **Debug Logging** - Added to both API and frontend  
3. ✅ **Diagnostic Script** - Verify data through the stack
4. ✅ **Testing Guide** - Step-by-step reproduction steps

## The Issue Explained

### What Should Happen
1. **Database** stores topic-bill relationships in `hot_topic_civic_items` table
2. **API** queries the database and returns each topic with a `civic_items` array
3. **Frontend** reads `topic.civic_items.length` to display the count
4. **Page** shows "5 bills", "3 bills", etc.

### What's Actually Happening
- **Frontend** is showing "0 bills" even though data was populated
- **Root cause is unknown** - could be:
  - API returning empty arrays
  - Frontend not calling correct API endpoint
  - Database has wrong structure
  - ID mismatch between tables

## Exact Code Locations

### API Endpoint (Server-side)
**File:** [worker/src/routes/hotTopics.mjs](worker/src/routes/hotTopics.mjs)

**Key function:** `handleListHotTopics()` (Lines 42-115 after debug additions)

**What it does:**
```javascript
1. SELECT all hot_topics (WHERE is_active = 1)
2. LEFT JOIN with hot_topic_civic_items to get civic_item_ids
3. For each civic_item_id, fetch full object from WY_DB.civic_items
4. Return each topic with: { ..., civic_items: [array of objects] }
```

**Field names:**
- Input: `hot_topics.id`, `hot_topic_civic_items.civic_item_id`
- Output: `topic.civic_items` (array of civic items)

### Frontend Display (Client-side)
**File:** [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js)

**Key function:** `loadHotTopics()` (Lines 5-87 after debug additions)

**What it does:**
```javascript
1. Fetch from: ${apiBase}/hot-topics
2. Get response: [{ id, title, ..., civic_items: [...] }, ...]
3. For each topic: const civicCount = (topic.civic_items || []).length
4. Render: "<strong>${civicCount}</strong> bill${civicCount !== 1 ? "s" : ""}"
```

**Field names:**
- Input: `topic.civic_items` array from API
- Output: Display text "X bills"

### Hugo Template
**File:** [layouts/hot-topics/list.html](layouts/hot-topics/list.html)

**What it does:**
- Renders container: `<div id="hotTopicsList">`
- JavaScript injects cards into this container
- No server-side rendering of counts

## Data Flow Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  EVENTS_DB.hot_topics (10 rows)          WY_DB.civic_items     │
│  ├─ id                                    ├─ id                │
│  ├─ title                                 ├─ bill_number       │
│  ├─ slug                                  ├─ title             │
│  └─ is_active                             └─ status            │
│       ↓                                                          │
│  EVENTS_DB.hot_topic_civic_items (N rows)                       │
│  ├─ topic_id ──────────────→ hot_topics.id                     │
│  └─ civic_item_id ──────────→ civic_items.id                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      WORKER API LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Route: GET /api/hot-topics                                     │
│  Handler: handleListHotTopics() [hotTopics.mjs]                │
│                                                                   │
│  SQL: SELECT ht.*, htci.civic_item_id                          │
│       FROM hot_topics ht                                         │
│       LEFT JOIN hot_topic_civic_items htci ON ...              │
│       WHERE ht.is_active = 1                                    │
│                                                                   │
│  Processing:                                                     │
│    - Group rows by topic.id                                     │
│    - Collect unique civic_item_ids                              │
│    - Fetch full civic_item objects from WY_DB                  │
│    - Add to topic.civic_items array                             │
│                                                                   │
│  Response Format:                                                │
│  [{                                                              │
│    id: 1,                                                        │
│    title: "Gun Rights",                                          │
│    slug: "gun-rights",                                           │
│    civic_items: [ { id, bill_number, title, ... }, ... ]      │
│  }, ...]                                                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  File: static/js/civic/hot-topics.js                            │
│  Function: loadHotTopics()                                      │
│                                                                   │
│  1. Determine API base:                                          │
│     apiBase = window.EVENTS_API_READY || window.EVENTS_API_URL  │
│     (Should resolve to: http://127.0.0.1:8787)                  │
│                                                                   │
│  2. Fetch data:                                                  │
│     fetch(`${apiBase}/hot-topics`)                              │
│                                                                   │
│  3. Extract count:                                               │
│     civicCount = (topic.civic_items || []).length               │
│                                                                   │
│  4. Render HTML:                                                 │
│     `<strong>${civicCount}</strong> bill${...}`                │
│                                                                   │
│  Display Container: #hotTopicsList (in list.html)               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Page shows: "0 bills" ❌
                    Expected:  "N bills" ✅
```

## Debug Logging Added

### Worker API Debug Output
**Trigger:** Append `?debug=1` to API call
```bash
curl "http://127.0.0.1:8787/api/hot-topics?debug=1"
```

**Check logs in:** Worker terminal (./scripts/wr dev output)

**Log messages:**
- `[HOT_TOPICS_DEBUG] SQL query returned X rows` - Raw query result count
- `[HOT_TOPICS_DEBUG] Found Y unique topics and Z unique civic_item_ids` - Aggregated counts
- `[HOT_TOPICS_DEBUG] fetchCivicItems returned W civic items` - Database lookups
- `[HOT_TOPICS_DEBUG] WARNING: civic_item_id X not found` - ID mismatch errors
- `[HOT_TOPICS_DEBUG] Final response: total items, per-topic breakdown` - Summary

### Frontend Debug Output
**Trigger:** Visit page with `?debug=1`
```
http://localhost:1313/hot-topics/?debug=1
```

**Check logs in:** Browser Console (F12 → Console tab)

**Log messages:**
- `[HOT_TOPICS_FRONTEND_DEBUG] API base: ...` - Resolved API endpoint
- `[HOT_TOPICS_FRONTEND_DEBUG] Fetching from: ...` - Full fetch URL
- `[HOT_TOPICS_FRONTEND_DEBUG] API response: ...` - Raw JSON response
- `[HOT_TOPICS_FRONTEND_DEBUG] First topic structure: ...` - Response structure
- `[HOT_TOPICS_FRONTEND_DEBUG] Topic: X, civic_items length: Y` - Per-topic data

## How to Use This Package

### Step 1: Add Debug Logging ✅ (Already Done)
Files have been updated with debug flag support:
- [worker/src/routes/hotTopics.mjs](worker/src/routes/hotTopics.mjs)
- [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js)

### Step 2: Run Diagnostic Tests
See [HOT_TOPICS_DEBUG_GUIDE.md](HOT_TOPICS_DEBUG_GUIDE.md) for:
- API testing with `curl`
- Database verification with `sqlite3`
- Frontend testing with browser dev tools
- Root cause identification

### Step 3: Identify Root Cause
Use debug output to categorize:

| Symptom | Root Cause | Fix Location |
|---------|-----------|--------------|
| API returns `civic_items: []` | Data not populated or ID mismatch | Database or API query |
| API returns `civic_items: [...]` but page shows "0" | Frontend not reading data | Frontend JS |
| API unreachable (500 error) | Database binding or table missing | Worker config |
| API works but page shows "0" | apiBase config wrong | Frontend JS or Hugo config |

### Step 4: Apply Minimal Fix
Once root cause is identified, make targeted fix in:
- [worker/src/routes/hotTopics.mjs](worker/src/routes/hotTopics.mjs) - If API issue
- [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js) - If frontend issue

## Quick Reference

### API Response Format
```json
[
  {
    "id": 1,
    "slug": "gun-rights",
    "title": "Gun Rights",
    "summary": "...",
    "badge": "Hot Topic",
    "civic_items": [
      {
        "id": 12345,
        "bill_number": "HB-001",
        "title": "Bill Title",
        "status": "introduced",
        ...
      }
    ]
  }
]
```

### Count Calculation
```javascript
civicCount = (topic.civic_items || []).length
// If civic_items exists: use its length
// If missing: use empty array length (0)
```

### SQL Query (Simplified)
```sql
SELECT ht.id, ht.title, htci.civic_item_id
FROM hot_topics ht
LEFT JOIN hot_topic_civic_items htci ON htci.topic_id = ht.id
WHERE ht.is_active = 1

-- For each unique civic_item_id, fetch:
SELECT id, bill_number, title, status, ...
FROM civic_items
WHERE id IN (...)
```

## Files Modified

### Code Changes
✅ [worker/src/routes/hotTopics.mjs](worker/src/routes/hotTopics.mjs)
   - Added debug logging to handleListHotTopics()
   - Logs at: SQL query, aggregation, fetch, final assembly stages

✅ [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js)
   - Added debug flag extraction from URL
   - Added debug logging for API base, fetch, response, per-topic data

### Documentation Added
✅ [HOT_TOPICS_DIAGNOSIS.md](HOT_TOPICS_DIAGNOSIS.md) - This file
✅ [HOT_TOPICS_DEBUG_GUIDE.md](HOT_TOPICS_DEBUG_GUIDE.md) - Testing guide

### Scripts Created
✅ [worker/scripts/diagnose-hot-topics-local.sh](worker/scripts/diagnose-hot-topics-local.sh)
   - Interactive diagnostic script
   - Checks database, API, and configuration

## Success Criteria

When fixed, these should all be true:

1. ✅ **API returns non-zero counts**
   ```bash
   curl http://127.0.0.1:8787/api/hot-topics | jq '.[] | .civic_items | length'
   # Output: 1, 2, 3, etc. (NOT 0 for all)
   ```

2. ✅ **Frontend displays non-zero counts**
   ```
   http://localhost:1313/hot-topics/
   # Shows: "5 bills", "3 bills", "1 bill", etc. (NOT "0 bills")
   ```

3. ✅ **Debug logs show data flowing through**
   ```
   [HOT_TOPICS_FRONTEND_DEBUG] Topic: Gun Rights, civic_items length: 5
   [HOT_TOPICS_FRONTEND_DEBUG] Topic: Education, civic_items length: 3
   ```

## Next Steps

1. **Start Worker:** `cd worker && npm run dev`
2. **Test API:** `curl "http://127.0.0.1:8787/api/hot-topics?debug=1"`
3. **Visit Frontend:** `http://localhost:1313/hot-topics/?debug=1`
4. **Check Logs:** Browser console + Worker terminal
5. **Identify Issue:** Use [HOT_TOPICS_DEBUG_GUIDE.md](HOT_TOPICS_DEBUG_GUIDE.md)
6. **Apply Fix:** Minimal change to identified issue

## Support Materials

- **Testing Guide:** [HOT_TOPICS_DEBUG_GUIDE.md](HOT_TOPICS_DEBUG_GUIDE.md)
- **Diagnostic Script:** [worker/scripts/diagnose-hot-topics-local.sh](worker/scripts/diagnose-hot-topics-local.sh)
- **API Code:** [worker/src/routes/hotTopics.mjs](worker/src/routes/hotTopics.mjs)
- **Frontend Code:** [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js)
- **Template:** [layouts/hot-topics/list.html](layouts/hot-topics/list.html)

---

**Created:** During diagnostic session for Hot Topics "0 bills" issue
**Status:** Debug package ready for testing
**Next:** Run tests with ?debug=1 flags to identify root cause
