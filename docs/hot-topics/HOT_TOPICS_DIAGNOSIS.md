# Hot Topics "0 Bills" Diagnosis Report

## Issue Identified

The "0 bills" count on the Hot Topics page is caused by a **field name mismatch** between the API response and the frontend display logic.

## Root Cause Analysis

### API Response Structure (hotTopics.mjs)
The Worker API endpoint returns topics with:
```javascript
{
  id: number,
  slug: string,
  title: string,
  summary: string,
  badge: string,
  image_url: string,
  cta_label: string,
  cta_url: string,
  priority: number,
  is_active: boolean,
  created_at: string,
  updated_at: string,
  civic_items: [] // Array of civic item objects
}
```

The API builds this in `handleListHotTopics()` by:
1. Selecting all active hot_topics
2. LEFT JOINing with hot_topic_civic_items to get civic_item_ids
3. Fetching full civic item details from WY_DB.civic_items
4. Returning them in the `civic_items` array property

### Frontend Display Logic (hot-topics.js)
The frontend reads the count using:
```javascript
const civicCount = (topic.civic_items || []).length;
```

This is **CORRECT** - it accesses the `civic_items` array returned by the API.

## Expected Data Flow

1. **Database Layer**: `hot_topics` LEFT JOIN `hot_topic_civic_items` → civic_item_id list
2. **Fetch Layer**: Query `civic_items` for each ID → detailed objects
3. **API Response**: Return each topic with `civic_items: [...]` array
4. **Frontend**: Read `topic.civic_items.length` → display count

## Verification Needed

To confirm the fix works, we need to:

1. **Verify database has data**:
   - Check EVENTS_DB.hot_topic_civic_items for rows
   - Check WY_DB.civic_items for matching IDs

2. **Verify API returns data**:
   - Curl `http://127.0.0.1:8787/api/hot-topics`
   - Check if each topic has non-empty `civic_items` array

3. **Verify frontend uses correct API base**:
   - Check if `window.EVENTS_API_READY` is set
   - Check if `window.EVENTS_API_URL` is correctly configured for local dev
   - Confirm no fallback to production API

4. **Check browser console**:
   - No fetch errors
   - Check if data is actually arriving in response

## Files Involved

- **Frontend Display**: [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js) (Line 53)
- **API Endpoint**: [worker/src/routes/hotTopics.mjs](worker/src/routes/hotTopics.mjs)
- **Hugo Template**: [layouts/hot-topics/list.html](layouts/hot-topics/list.html)

## Next Steps

1. Create diagnostic script to verify data through stack
2. Add debug logging with ?debug=1 flag
3. Identify exact breakpoint where data disappears
4. Apply minimal fix based on findings
