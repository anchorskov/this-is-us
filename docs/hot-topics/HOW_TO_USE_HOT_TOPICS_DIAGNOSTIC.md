# HOW TO USE THIS DIAGNOSTIC PACKAGE

## Start Here

You have a complete diagnostic package for the Hot Topics "0 bills" issue.

**Follow this path based on your situation:**

### 🏃 I Want Quick Results (5-15 minutes)
1. Open: [HOT_TOPICS_QUICK_START.md](HOT_TOPICS_QUICK_START.md)
2. Run the 5-minute diagnosis
3. Use the decision tree to identify your issue
4. Apply the fix

### 🚶 I Want to Understand the System (15-30 minutes)  
1. Read: [HOT_TOPICS_INVESTIGATION_COMPLETE.md](HOT_TOPICS_INVESTIGATION_COMPLETE.md)
2. Open: [HOT_TOPICS_DEBUG_GUIDE.md](HOT_TOPICS_DEBUG_GUIDE.md)
3. Follow the testing procedures
4. Check your findings against the guides

### 📚 I Want Complete Reference (30+ minutes)
1. Read: [HOT_TOPICS_COMPLETE_DIAGNOSTIC.md](HOT_TOPICS_COMPLETE_DIAGNOSTIC.md)
2. Review all code locations and data flows
3. Use as reference while testing
4. Apply fixes with full understanding

## What Was Changed

### Code Modifications (Debug Support Added)
- ✅ **Worker API:** [worker/src/routes/hotTopics.mjs](worker/src/routes/hotTopics.mjs)
  - Added `?debug=1` support
  - Detailed logging at each processing step
  
- ✅ **Frontend JS:** [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js)
  - Added `?debug=1` support
  - Logs API base, fetch, response, and per-topic data

### New Documentation
All are linked and cross-referenced:

1. **[HOT_TOPICS_DIAGNOSTIC_INDEX.md](HOT_TOPICS_DIAGNOSTIC_INDEX.md)** - Overview & navigation
2. **[HOT_TOPICS_QUICK_START.md](HOT_TOPICS_QUICK_START.md)** - 5-minute diagnosis
3. **[HOT_TOPICS_DEBUG_GUIDE.md](HOT_TOPICS_DEBUG_GUIDE.md)** - Detailed procedures
4. **[HOT_TOPICS_COMPLETE_DIAGNOSTIC.md](HOT_TOPICS_COMPLETE_DIAGNOSTIC.md)** - Full reference
5. **[HOT_TOPICS_INVESTIGATION_COMPLETE.md](HOT_TOPICS_INVESTIGATION_COMPLETE.md)** - Issue summary
6. **[HOT_TOPICS_DIAGNOSIS.md](HOT_TOPICS_DIAGNOSIS.md)** - Analysis findings

### New Script
- **[worker/scripts/diagnose-hot-topics-local.sh](worker/scripts/diagnose-hot-topics-local.sh)** - Automated checks

## The Problem in 30 Seconds

**What:** Hot Topics page shows "0 bills" on each topic card  
**But:** Data was populated to the database  
**So:** One of these is broken:
  1. Database doesn't have the data anymore
  2. API isn't fetching it from the database
  3. Frontend isn't calling the API
  4. Frontend isn't reading the response correctly
  5. Configuration points to wrong API

## The Solution in 30 Seconds

1. **Start Worker:** `cd worker && npm run dev`
2. **Test API:** `curl "http://127.0.0.1:8787/api/hot-topics?debug=1"`
3. **Check Frontend:** `http://localhost:1313/hot-topics/?debug=1` (F12 → Console)
4. **Use Decision Tree:** [HOT_TOPICS_QUICK_START.md](HOT_TOPICS_QUICK_START.md)
5. **Apply Fix:** Minimal change to identified issue

## Document Map

```
HOW_TO_USE_THIS_DIAGNOSTIC_PACKAGE.md ← You are here
    ↓
    ├─→ HOT_TOPICS_QUICK_START.md [5 min] ⭐ START HERE
    │   ├─ Decision tree
    │   ├─ Test commands
    │   └─ Common fixes
    │
    ├─→ HOT_TOPICS_INVESTIGATION_COMPLETE.md [10 min] Understanding
    │   ├─ Executive summary
    │   ├─ Code analysis
    │   └─ Root cause categories
    │
    ├─→ HOT_TOPICS_DEBUG_GUIDE.md [20 min] Procedures
    │   ├─ Step-by-step testing
    │   ├─ Database queries
    │   ├─ Browser dev tools
    │   └─ Troubleshooting
    │
    └─→ HOT_TOPICS_COMPLETE_DIAGNOSTIC.md [30+ min] Reference
        ├─ Architecture overview
        ├─ Data flow diagrams
        ├─ Debug output examples
        └─ Success criteria
```

## Required Before Testing

Make sure you have:
- [ ] Access to the project directory
- [ ] Node.js installed
- [ ] SQLite3 command-line tool (or database viewer)
- [ ] A web browser with DevTools
- [ ] Worker and Hugo running (or ability to start them)

## Testing Flow

```
Terminal 1: cd worker && npm run dev
    ↓ (wait for "Listening on http://127.0.0.1:8787")
    
Terminal 2: curl "http://127.0.0.1:8787/api/hot-topics?debug=1" | jq
    ↓ (check if civic_items array has data)
    
Browser: http://localhost:1313/hot-topics/?debug=1
    ↓ (F12 → Console, look for [HOT_TOPICS_FRONTEND_DEBUG] logs)
    
Compare outputs → Identify issue → Apply fix
```

## What Each Document Does

### HOT_TOPICS_QUICK_START.md
**Use this to:** Get answer in 5 minutes

**Contains:**
- 5-minute diagnosis procedure
- Decision tree ("If API returns X, then...")
- Common fixes with code locations
- Copy/paste test commands

**Read this if:** You want quick results

---

### HOT_TOPICS_INVESTIGATION_COMPLETE.md
**Use this to:** Understand the architecture

**Contains:**
- Executive summary of issue
- Code analysis results (what's correct/wrong)
- Problem categories with indicators
- Data flow diagram
- Success criteria

**Read this if:** You want to understand before fixing

---

### HOT_TOPICS_DEBUG_GUIDE.md
**Use this to:** Follow detailed procedures

**Contains:**
- Step-by-step testing for each component
- Database verification queries
- API testing with curl
- Browser network tab instructions
- Troubleshooting guide
- Quick diagnostics script

**Read this if:** You want thorough testing

---

### HOT_TOPICS_COMPLETE_DIAGNOSTIC.md
**Use this to:** Have complete reference

**Contains:**
- Full architecture explanation
- Data flow visualization
- All debug logging output examples
- SQL query details and analysis
- Field name reference
- Success criteria with examples

**Read this if:** You're implementing the fix and need details

---

### HOT_TOPICS_DIAGNOSTIC_INDEX.md
**Use this to:** Navigate the package

**Contains:**
- Document index
- Quick reference
- File modification list
- Success criteria summary

**Read this if:** You need overview of what's available

---

## Quick Reference: Test Commands

```bash
# Test 1: Is database populated?
sqlite3 /path/to/events.db "SELECT COUNT(*) FROM hot_topic_civic_items;"
# Should return: > 0

# Test 2: Is API working?
curl http://127.0.0.1:8787/api/hot-topics | jq '.[] | .civic_items | length'
# Should return: 1, 2, 3, etc. (NOT all 0)

# Test 3: Is frontend getting data?
# Visit: http://localhost:1313/hot-topics/?debug=1
# Check browser console for: [HOT_TOPICS_FRONTEND_DEBUG] API response:

# Test 4: Comprehensive debug
curl "http://127.0.0.1:8787/api/hot-topics?debug=1"
# Check worker terminal for: [HOT_TOPICS_DEBUG] ...
```

## Typical Scenarios

### Scenario A: "API works but page shows 0"
1. **Diagnosis:** Frontend not reading API correctly
2. **Check:** window.EVENTS_API_URL in browser console
3. **Fix:** Update [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js) line 14
4. **Guide:** [HOT_TOPICS_QUICK_START.md](HOT_TOPICS_QUICK_START.md) → Pattern 3

### Scenario B: "API returns empty arrays"
1. **Diagnosis:** Database doesn't have data
2. **Check:** `SELECT COUNT(*) FROM hot_topic_civic_items;`
3. **Fix:** Populate database with bill scanner
4. **Guide:** [HOT_TOPICS_DEBUG_GUIDE.md](HOT_TOPICS_DEBUG_GUIDE.md) → Issue: Database doesn't have data

### Scenario C: "API returns 500 error"
1. **Diagnosis:** Configuration or table missing
2. **Check:** Worker logs + ./scripts/wr.toml database bindings
3. **Fix:** Verify table exists + bindings correct
4. **Guide:** [HOT_TOPICS_DEBUG_GUIDE.md](HOT_TOPICS_DEBUG_GUIDE.md) → If You Get Stuck

## Files You Can Edit

Based on your diagnosis:

**If it's a database issue:**
- No code changes needed
- Populate data using bill scanner
- Or manually: `INSERT INTO hot_topic_civic_items ...`

**If it's an API issue:**
- Edit: [worker/src/routes/hotTopics.mjs](worker/src/routes/hotTopics.mjs)
- Focus: Lines 42-116 (handleListHotTopics function)

**If it's a frontend issue:**
- Edit: [static/js/civic/hot-topics.js](static/js/civic/hot-topics.js)
- Focus: Lines 5-87 (loadHotTopics function)
- Or update: window.EVENTS_API_URL configuration

**If it's a configuration issue:**
- Edit: [worker/./scripts/wr.toml](worker/./scripts/wr.toml)
- Check: Database bindings for EVENTS_DB and WY_DB

## Support Materials

All guides cross-reference each other:
- Each has links to related guides
- Each links to relevant code files
- Each links to useful test commands

Example links in guides:
- "See [HOT_TOPICS_QUICK_START.md#decision-tree]()" for decision tree
- "[worker/src/routes/hotTopics.mjs]() line 53" for code reference
- Code snippets have file location comments

## Getting Unstuck

If you're unsure what to do:

1. **Start:** [HOT_TOPICS_QUICK_START.md](HOT_TOPICS_QUICK_START.md) - takes 5 minutes
2. **Stuck at Step 2?** → [HOT_TOPICS_DEBUG_GUIDE.md](HOT_TOPICS_DEBUG_GUIDE.md)
3. **Still stuck?** → [HOT_TOPICS_COMPLETE_DIAGNOSTIC.md](HOT_TOPICS_COMPLETE_DIAGNOSTIC.md)
4. **Need overview?** → [HOT_TOPICS_INVESTIGATION_COMPLETE.md](HOT_TOPICS_INVESTIGATION_COMPLETE.md)

## Success Indicators

You'll know you're on the right track when:

✅ You can run: `curl http://127.0.0.1:8787/api/hot-topics | jq` and get JSON  
✅ You can see: `[HOT_TOPICS_FRONTEND_DEBUG]` logs in browser console  
✅ You can identify: Which component returns wrong/empty data  
✅ You know: Exactly what field name is being used (civic_items)  
✅ You can fix: With just 1-2 line changes  

When all 5 are true, you're ready to apply the fix!

---

## Summary

- ✅ **Code updated** with debug logging
- ✅ **Documentation created** - 6 comprehensive guides  
- ✅ **Script created** for automated checking
- ✅ **Cross-referenced** - easy navigation
- ✅ **Ready to diagnose** - start with Quick Start guide

**→ Next: Open [HOT_TOPICS_QUICK_START.md](HOT_TOPICS_QUICK_START.md) and run the 5-minute diagnosis**
