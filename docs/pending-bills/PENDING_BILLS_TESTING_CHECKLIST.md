# Pending Bills Feature - Testing Checklist

## ✅ Pre-Flight Checks

- [x] Servers running (`./start_local.sh`)
  - Hugo on 1313
  - Wrangler on 8787
- [x] Database migrations applied
  - 0011_add_ai_summary_fields_to_civic_items.sql
  - civic_item_ai_tags table exists
- [x] Test bills seeded (5 bills: HB 22, HB 164, SF 174, HB 286, SF 89)
- [x] Test bills have correct schema:
  - level = 'statewide'
  - jurisdiction_key = 'WY'
  - status IN ('introduced', 'in_committee', 'pending_vote')
- [x] Topic associations created in civic_item_ai_tags
  - All with confidence ≥ 0.87 (above 0.5 threshold)
- [x] Topic metadata exists in EVENTS_DB
  - property-tax-relief, water-rights, education-funding, energy-permitting, public-safety-fentanyl

---

## 🧪 API Endpoint Testing

### Test 1: Basic Endpoint Availability
```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq '.results | length'
# Expected: 5
```

### Test 2: Response Shape
```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq '.results[0] | keys'
# Expected: ["id", "bill_number", "title", "chamber", "status", "legislative_session", 
#            "subject_tags", "ai_plain_summary", "ai_key_points", "topics"]
```

### Test 3: AI Summary Fields
```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq '.results[0].ai_plain_summary, .results[0].ai_key_points'
# Expected: Non-empty string for summary, array with 2 items for key points
```

### Test 4: Topics Populated
```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq '.results[0].topics'
# Expected: Array with 1+ topic objects containing:
#   - slug (string)
#   - label (string, topic title)
#   - confidence (number, e.g., 0.92)
#   - reason_summary (string)
#   - trigger_snippet (string)
#   - user_prompt_template (string)
```

### Test 5: Confidence Threshold
```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | jq '.results[].topics[].confidence'
# Expected: All values ≥ 0.5 (actual: 0.85-0.92)
```

### Test 6: Topic Filter
```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?topic_slug=water-rights" | jq '.results | length'
# Expected: 1 (only HB 164)
```

```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?topic_slug=water-rights" | jq '.results[0].bill_number'
# Expected: "HB 164"
```

### Test 7: Session Filter
```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?session=2025" | jq '.results | length'
# Expected: 5 (all test bills use 2025)
```

### Test 8: Status Filter
```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?status=in_committee" | jq '.results[0].bill_number'
# Expected: "HB 164"
```

### Test 9: Combined Filters
```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?topic_slug=property-tax-relief&status=introduced" | jq '.results[0].bill_number'
# Expected: "HB 22"
```

### Test 10: Invalid Topic Slug
```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics?topic_slug=nonexistent" | jq '.results'
# Expected: [] (empty array, no error)
```

---

## 🎨 Browser Console Testing

Open DevTools → Console and visit `http://localhost:1313/civic/pending/`

### Check Log Output
Expected logs (in order):
```
🔍 Fetching bills from: ...
📡 Fetch response status: 200 ok: true
📦 Raw response: {"results":[...]}
✅ Parsed data: Object
📋 Bills array: 5 items
🔍 First bill structure: {...}
🔄 Starting refresh...
📊 Loaded 5 bills, syncing session options...
🎨 Rendering 5 bills...
✅ Render complete
```

### Check for Errors
- No errors in console ✓
- No 404s in Network tab ✓
- No JSON.parse errors ✓
- No undefined reference errors ✓

---

## 🎯 UI Rendering Testing

Visit: `http://localhost:1313/civic/pending/`

### Visual Checks
- [ ] Page loads without errors
- [ ] 5 bill cards visible
- [ ] Each card displays:
  - [ ] Bill number (e.g., "HB 164")
  - [ ] Bill title (e.g., "Groundwater Withdrawal Permits")
  - [ ] Chamber and status (e.g., "lower • in_committee")
  - [ ] Legislative session (e.g., "Session 2025")
  - [ ] AI summary section with text (not truncated)
  - [ ] Key points list with 2-3 items
  - [ ] Topic badges showing:
    - [ ] Topic name (e.g., "Water")
    - [ ] Confidence score (e.g., "confidence 0.88")
    - [ ] "Copy prompt" button
  - [ ] Trigger snippet in quotes
  - [ ] Reason summary text

### Interactive Checks
- [ ] Click "Copy prompt" button → "Copied!" feedback
- [ ] Click topic filter dropdown → All topics listed (in order of priority)
- [ ] Change topic filter → Bills update to show only matching bills
- [ ] Change session filter → Bills update
- [ ] Change chamber filter → Bills update
- [ ] Multiple filters combined → Works correctly
- [ ] Filter to nonexistent topic → Shows "No bills matched those filters yet"

---

## 📊 Database Verification

### Bills Present and Correct
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT bill_number, status, level, jurisdiction_key FROM civic_items ORDER BY bill_number;" --json
```

Expected output:
```
| bill_number | status         | level      | jurisdiction_key |
|-------------|----------------|------------|------------------|
| HB 164      | in_committee   | statewide  | WY               |
| HB 22       | introduced     | statewide  | WY               |
| HB 286      | pending_vote   | statewide  | WY               |
| SF 174      | introduced     | statewide  | WY               |
| SF 89       | introduced     | statewide  | WY               |
```

### AI Summaries Present
```bash
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT bill_number, LENGTH(ai_summary) as summary_chars, LENGTH(ai_key_points) as keypoints_chars FROM civic_items ORDER BY bill_number;" --json
```

Expected: All > 0 for both columns

### Topic Associations Present
```bash
./scripts/wr d1 execute WY_DB --local --command \
  "SELECT item_id, topic_slug, confidence, reason_summary FROM civic_item_ai_tags ORDER BY item_id;" --json
```

Expected: 5 rows with:
- confidence between 0.85 and 0.92
- reason_summary populated
- topic_slug matching EVENTS_DB topics

---

## 🔧 Debugging Tips

### If bills don't appear:

1. **Check JavaScript console** for error messages
2. **Check Network tab** for HTTP status (should be 200)
3. **Check Response tab** for API response format
4. **Run database queries** to verify data exists:
   ```bash
   ./scripts/wr d1 execute WY_DB --local --command \
     "SELECT COUNT(*) FROM civic_items WHERE level='statewide' AND jurisdiction_key='WY';" --json
   ```
   Expected: 5

5. **Check filters applied** - if empty results, try resetting all filters
6. **Check topics exist** in EVENTS_DB:
   ```bash
   ./scripts/wr d1 execute EVENTS_DB --local --command \
     "SELECT slug FROM hot_topics WHERE is_active=1;" --json
   ```

### If AI summary doesn't show:

1. **Verify civic_items.ai_summary is populated:**
   ```bash
   ./scripts/wr d1 execute WY_DB --local --command \
     "SELECT bill_number, ai_summary FROM civic_items LIMIT 1;" --json
   ```
   Expected: Non-null, non-empty string

2. **Check client-side parsing** - open DevTools and run:
   ```javascript
   fetch('/api/civic/pending-bills-with-topics')
     .then(r => r.json())
     .then(d => console.log(d.results[0].ai_plain_summary))
   ```

### If topics don't show:

1. **Verify civic_item_ai_tags entries exist:**
   ```bash
   ./scripts/wr d1 execute WY_DB --local --command \
     "SELECT COUNT(*) FROM civic_item_ai_tags;" --json
   ```
   Expected: 5 (one per bill)

2. **Check confidence threshold** - all tags must have confidence ≥ 0.5:
   ```bash
   ./scripts/wr d1 execute WY_DB --local --command \
     "SELECT COUNT(*) FROM civic_item_ai_tags WHERE confidence < 0.5;" --json
   ```
   Expected: 0

3. **Verify topic metadata** in EVENTS_DB exists:
   ```bash
   ./scripts/wr d1 execute EVENTS_DB --local --command \
     "SELECT COUNT(*) FROM hot_topics WHERE is_active=1;" --json
   ```
   Expected: > 0

---

## ✨ Success Criteria

All of the following must pass:

- ✅ API endpoint returns 200 status
- ✅ Response contains `{ results: [...] }` with 5 items
- ✅ Each result has `ai_plain_summary` (non-empty string)
- ✅ Each result has `ai_key_points` (array, length ≥ 1)
- ✅ Each result has `topics` (array, length ≥ 1)
- ✅ Each topic has `confidence` ≥ 0.5
- ✅ Each topic has `reason_summary` (non-empty string)
- ✅ Browser console shows detailed logs (no errors)
- ✅ UI renders 5 bill cards with full content
- ✅ Filters work (topic, session, chamber, status)
- ✅ No console errors or warnings
- ✅ No silent failures or undefined references

---

## Quick Smoke Test

Run this one command to verify everything:

```bash
curl -s "http://127.0.0.1:8787/api/civic/pending-bills-with-topics" | \
  jq '.results | length as $count | 
      if $count == 5 then 
        "✅ 5 bills returned" 
      else 
        "❌ Expected 5 bills, got " + ($count | tostring) 
      end,
      (.[] | select(.ai_plain_summary | length == 0) | .bill_number) as $empty |
      if $empty then "❌ Bill \($empty) missing ai_plain_summary" else "✅ All bills have ai_plain_summary" end,
      (.[] | select(.topics | length == 0) | .bill_number) as $notopic |
      if $notopic then "❌ Bill \($notopic) has no topics" else "✅ All bills have topics" end,
      (.[] | .topics[] | select(.confidence < 0.5) | .slug) as $lowconf |
      if $lowconf then "❌ Topic \($lowconf) below confidence threshold" else "✅ All topics above threshold" end'
```

Expected output:
```
"✅ 5 bills returned"
"✅ All bills have ai_plain_summary"
"✅ All bills have topics"
"✅ All topics above threshold"
```

---

## Files Modified

1. `static/js/civic/pending-bills.js` - Added client-side logging
2. `worker/src/routes/pendingBills.mjs` - Added server-side logging
3. Database via ./scripts/wr - Updated 5 test bills, inserted 5 topic associations
4. `documentation/PENDING_BILLS_DIAGNOSTICS.md` - Full diagnostics report

---

## Next Steps

1. ✅ Run all tests in this checklist
2. ✅ Verify all checks pass
3. 📋 Create fixtures for integration tests (snapshot response format)
4. 📋 Add end-to-end tests (API + rendering)
5. 📋 Consider adding the `/civic/pending/` page to site navigation
6. 📋 Plan for production data seeding (real Wyoming bills)

---

**Last Updated:** December 5, 2025  
**Status:** Ready for Integration Testing
