# Hot Topics Quick-Start Debugging

## 5-Minute Diagnosis

### 1. Start Services (Terminal 1)
```bash
cd worker && npm run dev
# Wait for: "Listening on http://127.0.0.1:8787"
```

### 2. Test API (Terminal 2)
```bash
# Simple test
curl http://127.0.0.1:8787/api/hot-topics | jq '.[] | {title: .title, bills: (.civic_items | length)}'

# Example output (GOOD):
# { "title": "Gun Rights", "bills": 5 }
# { "title": "Education", "bills": 0 }

# Example output (BAD):
# { "title": "Gun Rights", "bills": 0 }
# { "title": "Education", "bills": 0 }
```

### 3. Check Database (Terminal 2)
```bash
# Do hot_topic_civic_items records exist?
sqlite3 /path/to/events.db "SELECT COUNT(*) FROM hot_topic_civic_items;"
# Should return: > 0

# Do those IDs exist in civic_items?
sqlite3 /path/to/events.db "SELECT civic_item_id FROM hot_topic_civic_items LIMIT 5;"
sqlite3 /path/to/wy.db "SELECT id FROM civic_items WHERE id IN (123, 456, 789);"
# Should match
```

### 4. Visit Frontend (Browser)
```
http://localhost:1313/hot-topics/?debug=1
```
Open DevTools: F12 → Console tab

**Look for these log patterns:**

```javascript
[HOT_TOPICS_FRONTEND_DEBUG] API base: http://127.0.0.1:8787  ✓ Good
[HOT_TOPICS_FRONTEND_DEBUG] API base: https://...production... ✗ Wrong!

[HOT_TOPICS_FRONTEND_DEBUG] Topic: Gun Rights, civic_items length: 5  ✓ Good
[HOT_TOPICS_FRONTEND_DEBUG] Topic: Gun Rights, civic_items length: 0  ✗ Problem
```

## Decision Tree

### API returns bills (civic_items > 0) but page shows "0"
**Frontend issue** → Check:
1. API base is pointing to local worker
2. No fetch errors in Network tab
3. Response data is being read correctly

### API returns empty (civic_items all 0)
**Database issue** → Check:
1. Database actually has data: `SELECT COUNT(*) FROM hot_topic_civic_items`
2. IDs match: Civic IDs in EVENTS_DB exist in WY_DB
3. Query is correct: See [HOT_TOPICS_COMPLETE_DIAGNOSTIC.md](HOT_TOPICS_COMPLETE_DIAGNOSTIC.md)

### API returns error (500)
**Configuration issue** → Check:
1. Worker ./scripts/wr.toml has database bindings
2. EVENTS_DB and WY_DB exist
3. hot_topics table exists: `SELECT COUNT(*) FROM hot_topics`

### API unreachable (connection refused)
**Service not running** → Check:
1. Worker running: `npm run dev` in worker directory
2. Listening on: http://127.0.0.1:8787
3. No port conflicts

## Common Fixes

### Issue: API base points to production
**In browser console:**
```javascript
window.EVENTS_API_URL
```
If this returns production URL, update:
- [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js) line 14
- Or the config file that sets `window.EVENTS_API_URL`

### Issue: Database doesn't have data
Run the bill scanner to populate:
```bash
# From the root directory
node worker/src/jobs/civicScan.mjs
```

Or manually add test data:
```bash
sqlite3 /path/to/events.db
INSERT INTO hot_topic_civic_items (topic_id, civic_item_id) VALUES (1, 12345);
```

### Issue: Mismatch between topic_id and civic_item_id
Verify the join works:
```bash
sqlite3 /path/to/events.db
SELECT DISTINCT htci.topic_id FROM hot_topic_civic_items htci WHERE topic_id IS NOT NULL LIMIT 5;
# Should return: 1, 2, 3, etc. (valid topic IDs)

SELECT DISTINCT htci.civic_item_id FROM hot_topic_civic_items htci WHERE civic_item_id IS NOT NULL LIMIT 5;
# Should return valid civic_item IDs
```

Then verify those civic items exist:
```bash
sqlite3 /path/to/wy.db
SELECT COUNT(*) FROM civic_items WHERE id IN (SELECT civic_item_id FROM hot_topic_civic_items LIMIT 5);
# Should return: 5 (or whatever your LIMIT was)
```

## Minimal Fix Patterns

### Pattern 1: API not returning correct field
If API returns civic_items but frontend is looking for different field:
```javascript
// OLD (looking for wrong field)
const civicCount = topic.count || 0;  // ✗

// NEW (looking for correct field)
const civicCount = (topic.civic_items || []).length;  // ✓
```

**File:** [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js) line 53

### Pattern 2: API not populating civic_items
If database has data but API returns empty array:
```javascript
// Check: Is the SQL query joining correctly?
// Check: Is fetchCivicItems being called?
// Check: Are civic_item_ids being extracted?
```

**File:** [worker/src/routes/hotTopics.mjs](worker/src/routes/hotTopics.mjs) line 70-80

Run with `?debug=1` to see exact flow.

### Pattern 3: Frontend calling wrong API
If frontend works but points to production:
```javascript
// OLD (might default to production)
const apiBase = window.EVENTS_API_URL || "/api";  // ✗

// NEW (explicitly set for local dev)
const apiBase = "http://127.0.0.1:8787";  // ✓
```

**File:** [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js) line 14

## Test Commands

```bash
# 1. API returns correct data?
curl http://127.0.0.1:8787/api/hot-topics | jq '.[] | .civic_items | length'

# 2. Database has data?
sqlite3 /path/to/events.db "SELECT COUNT(*) FROM hot_topic_civic_items;"

# 3. IDs match?
sqlite3 /path/to/events.db "SELECT DISTINCT civic_item_id FROM hot_topic_civic_items LIMIT 1;" | \
sqlite3 /path/to/wy.db "SELECT id FROM civic_items WHERE id = ?;"

# 4. Frontend reading API correctly?
# Visit http://localhost:1313/hot-topics/?debug=1
# Check browser console for: [HOT_TOPICS_FRONTEND_DEBUG] API response:

# 5. API actually being called?
# In browser: DevTools → Network tab, reload, look for /api/hot-topics request
```

## Before You Start

Make sure:
- [ ] Worker running: `npm run dev`
- [ ] Hugo running: `hugo server` (or `npm run dev` from root)
- [ ] Databases exist and have data
- [ ] No other process on port 8787

## If You Get Stuck

1. **Check the detailed guides:**
   - [HOT_TOPICS_COMPLETE_DIAGNOSTIC.md](HOT_TOPICS_COMPLETE_DIAGNOSTIC.md) - Full explanation
   - [HOT_TOPICS_DEBUG_GUIDE.md](HOT_TOPICS_DEBUG_GUIDE.md) - Testing procedures

2. **Run the diagnostic script:**
   - [worker/scripts/diagnose-hot-topics-local.sh](worker/scripts/diagnose-hot-topics-local.sh)

3. **Add debug logging:**
   - URL: `?debug=1`
   - API logs: Worker terminal
   - Frontend logs: Browser console

4. **Key files:**
   - API: [worker/src/routes/hotTopics.mjs](worker/src/routes/hotTopics.mjs)
   - Frontend: [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js)

---

**Status:** Debug package ready
**Next:** Run the 5-minute diagnosis above and check decision tree
