# Hot Topics Debugging & Testing Guide

## Quick Start Testing

### 1. Verify Worker is Running
```bash
# In worker directory
npm run dev
# or
./scripts/wr dev
```

Expected output: Local server running at `http://127.0.0.1:8787`

### 2. Test API Directly (With Debug Output)
```bash
# Basic test (no debug)
curl http://127.0.0.1:8787/api/hot-topics | jq .

# With debug logging (check worker logs)
curl "http://127.0.0.1:8787/api/hot-topics?debug=1" | jq .
```

**What to look for in response:**
- Array of topic objects
- Each topic should have `civic_items: [...]` property
- First few topics should have items if data was populated

Example expected response:
```json
[
  {
    "id": 1,
    "title": "Gun Rights",
    "civic_items": [
      {
        "id": 12345,
        "bill_number": "HB-001",
        "title": "...",
        ...
      }
    ]
  }
]
```

### 3. Test Frontend With Debug Flag
```
http://localhost:1313/hot-topics/?debug=1
```

**Open browser dev console (F12) and check for logs:**
- `[HOT_TOPICS_FRONTEND_DEBUG] API base: ...`
- `[HOT_TOPICS_FRONTEND_DEBUG] Fetching from: ...`
- `[HOT_TOPICS_FRONTEND_DEBUG] API response: ...`
- `[HOT_TOPICS_FRONTEND_DEBUG] First topic structure: ...`

Each topic in logs should show: `civic_items length: X, civic_items: [...]`

### 4. Verify Data in Databases

#### Check EVENTS_DB for topics
```bash
sqlite3 /path/to/events.db
SELECT id, title, is_active FROM hot_topics WHERE is_active = 1;
```

#### Check EVENTS_DB for topic-bill links
```bash
SELECT topic_id, COUNT(*) as item_count 
FROM hot_topic_civic_items 
GROUP BY topic_id;
```

#### Check WY_DB for civic items
```bash
SELECT id, bill_number, title 
FROM civic_items 
WHERE id IN (
  SELECT civic_item_id FROM hot_topic_civic_items
);
```

## Root Cause Diagnosis

### Symptom: API returns empty `civic_items` array

**Step 1:** Check if hot_topic_civic_items table has data
```bash
SELECT COUNT(*) FROM hot_topic_civic_items;
```
- If 0: Data wasn't populated, need to run bill scanner again
- If > 0: Proceed to Step 2

**Step 2:** Check if civic_items exist for those IDs
```bash
SELECT htci.topic_id, htci.civic_item_id, ci.id, ci.bill_number
FROM hot_topic_civic_items htci
LEFT JOIN civic_items ci ON ci.id = htci.civic_item_id;
```
- If NULL for ci.id: Mismatch between database IDs
- If data exists: Proceed to Step 3

**Step 3:** Check Worker logs
Look for debug output when calling API with `?debug=1`
- `fetchCivicItems returned 0 civic items` = ID mismatch
- `WARNING: civic_item_id X not found` = ID doesn't exist in WY_DB
- `Final response: 0 total civic_items` = Data exists but not being matched

### Symptom: Frontend shows "0 bills" even with API returning data

**Step 1:** Check browser Network tab
- Go to DevTools → Network → XHR/Fetch
- Reload page
- Check the `/api/hot-topics` request
- If red (failed): Check apiBase configuration
- If green (success): Check response body for data

**Step 2:** Check browser Console
- Look for `[HOT_TOPICS_FRONTEND_DEBUG]` logs
- Check if API response contains `civic_items` array
- Look for any fetch errors

**Step 3:** Check Frontend Configuration
```javascript
// In browser console, check:
window.EVENTS_API_READY
window.EVENTS_API_URL
window.location.href
```

Expected behavior:
- For localhost: apiBase should resolve to `http://127.0.0.1:8787` or similar
- NOT a production URL

## File Locations for Reference

**API Code:** [worker/src/routes/hotTopics.mjs](../../worker/src/routes/hotTopics.mjs)
- Lines 42-100: `handleListHotTopics()` - Main endpoint
- Contains SQL query and data joining logic

**Frontend Code:** [static/js/civic/hot-topics.js](../../static/js/civic/hot-topics.js)
- Lines 5-60: `loadHotTopics()` - Fetch and render
- Line 16: API base selection
- Line 36: Fetch call
- Line 53: Count calculation

**Template:** [layouts/hot-topics/list.html](../../layouts/hot-topics/list.html)
- Contains container `#hotTopicsList` where JS injects cards

## Debug Flag Summary

Both Worker and Frontend now support `?debug=1` parameter:

**Worker API:**
```
curl "http://127.0.0.1:8787/api/hot-topics?debug=1"
```
Logs to: Worker console (./scripts/wr dev terminal)

**Frontend:**
```
http://localhost:1313/hot-topics/?debug=1
```
Logs to: Browser console (F12 → Console tab)

Check both simultaneously for end-to-end tracing.

## Data Flow Trace

```
User visits: http://localhost:1313/hot-topics/?debug=1
           ↓
Frontend loads hot-topics.js [DEBUG] API base: ... 
           ↓
Frontend calls: http://127.0.0.1:8787/api/hot-topics?debug=1 [DEBUG] Fetching from: ...
           ↓
Worker receives request [DEBUG] SQL query returned X rows
           ↓
Worker processes topics [DEBUG] Found Y unique topics and Z civic_item_ids
           ↓
Worker fetches civic items from WY_DB [DEBUG] fetchCivicItems returned W items
           ↓
Worker combines data [DEBUG] Final response: total items, per-topic breakdown
           ↓
Worker returns JSON to frontend [DEBUG] API response: {...}
           ↓
Frontend renders cards [DEBUG] Topic: X, civic_items length: Y, civic_items: [...]
           ↓
User sees: "X bills" under each topic card
```

## Common Issues & Fixes

### Issue: "0 bills" displays on page

**Check 1: API working?**
```bash
curl http://127.0.0.1:8787/api/hot-topics | jq '.[] | {title: .title, count: (.civic_items | length)}'
```
If all counts are 0, API has issue. If counts > 0, frontend has issue.

**Check 2: Frontend calling right URL?**
```javascript
// In browser console:
window.EVENTS_API_URL
window.EVENTS_API_READY  // May be a Promise
```

**Check 3: Database populated?**
```bash
sqlite3 /path/to/events.db
SELECT COUNT(*) FROM hot_topic_civic_items;
```
If 0, run bill scanner to populate data.

### Issue: API returns 500 error

Check Worker logs for SQL errors or crashes:
```
curl "http://127.0.0.1:8787/api/hot-topics?debug=1"
```

Common causes:
- EVENTS_DB.hot_topic_civic_items table doesn't exist
- WY_DB.civic_items doesn't exist
- Missing database binding in ./scripts/wr.toml

### Issue: API returns empty array `[]`

Check if hot_topics table is populated:
```bash
sqlite3 /path/to/events.db
SELECT COUNT(*) FROM hot_topics WHERE is_active = 1;
```

If 0, no topics exist. If > 0, check WHERE clause or table structure.

## Quick Diagnostics Script

```bash
#!/bin/bash
# Save as verify-hot-topics.sh

echo "=== Database Check ==="
echo "Topics:" && sqlite3 /path/to/events.db "SELECT COUNT(*) FROM hot_topics WHERE is_active = 1;" 
echo "Links:" && sqlite3 /path/to/events.db "SELECT COUNT(*) FROM hot_topic_civic_items;"
echo "Civic Items:" && sqlite3 /path/to/wy.db "SELECT COUNT(*) FROM civic_items;"

echo ""
echo "=== API Response Check ==="
curl -s "http://127.0.0.1:8787/api/hot-topics" | jq 'length' && echo "topics returned"

echo ""
echo "=== Frontend URL Check ==="
echo "Visit: http://localhost:1313/hot-topics/?debug=1"
echo "Check browser console for [HOT_TOPICS_FRONTEND_DEBUG] logs"
```

---

## Success Criteria

✅ **API returns topic with civic_items > 0**
```bash
curl http://127.0.0.1:8787/api/hot-topics | jq '.[0].civic_items | length'
# Should output: 1 or more
```

✅ **Frontend shows counts > 0**
```
http://localhost:1313/hot-topics/
# Should display: "X bills" under each topic (X > 0)
```

✅ **Debug logs trace end-to-end**
```
[HOT_TOPICS_FRONTEND_DEBUG] API response: [{..., civic_items: [{...}]}]
```

When all three criteria are met, the issue is fixed!
