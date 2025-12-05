# D1 Schema Refinement – Complete Summary

**Date:** December 5, 2025  
**Commit:** 895fbbb  
**Status:** ✅ All changes committed and ready for local/remote application

---

## Schema Changes Implemented

### 1. civic_item_ai_tags (WY_DB) – COMPLETED ✅

**Migration:** `worker/migrations_wy/0010_add_reason_summary_to_civic_item_ai_tags.sql`

**Changes:**
- Added `reason_summary TEXT` column to store AI explanation of why a bill matches a topic
- Default: NULL (gracefully handles missing values)

**Current Table Definition:**
```sql
CREATE TABLE civic_item_ai_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,            -- references civic_items.id
  topic_slug TEXT NOT NULL,         -- matches EVENTS_DB.hot_topics.slug
  confidence REAL NOT NULL,
  trigger_snippet TEXT,
  reason_summary TEXT,              -- ← NEW (Migration 0010)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Data Persistence:**
- Function: `saveHotTopicAnalysis(env, billId, analysis)` in `worker/src/lib/hotTopicsAnalyzer.mjs`
- Saves: `INSERT INTO civic_item_ai_tags (item_id, topic_slug, confidence, trigger_snippet, reason_summary) VALUES (?1, ?2, ?3, ?4, ?5)`
- Example reason_summary: 
  > "This bill directly addresses homeowner concerns by capping property tax assessment increases to 3% per year, protecting families and retirees from sudden tax spikes."

**Status:** ✅ Applied locally and remotely

---

### 2. hot_topics (EVENTS_DB) – COMPLETED ✅

**Migration:** `worker/migrations/0015_add_match_criteria_json_to_hot_topics.sql`

**Changes:**
- Added `match_criteria_json TEXT` column for future rule-based filtering

**Current Table Definition:**
```sql
CREATE TABLE hot_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  badge TEXT,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  priority INTEGER DEFAULT 100,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  match_criteria_json TEXT              -- ← NEW (Migration 0015)
);
```

**Intended Use:**
The `match_criteria_json` column will store serialized JSON describing match criteria, e.g.:
```json
{
  "title_keywords": ["property", "tax", "assessment"],
  "summary_keywords": ["homeowner", "burden"],
  "subject_tags": ["Tax Reform"],
  "exclude_keywords": ["federal"],
  "min_rule_score": 0.7
}
```

**Current Usage:** NULL (placeholder for future rule-based filtering)  
**Future Plan:** Populate via admin interface; use in `saveHotTopicAnalysis()` for alternative matching strategies

**Status:** ✅ Migration created, ready to apply

---

## Code Documentation Updates

### hotTopicsAnalyzer.mjs

**1. Output Shape Documentation (Lines 23–35)**
- Already documents `reason_summary` field in output JSON:
  ```
  "reason_summary": "One to three sentences explaining why this bill matches this topic."
  ```

**2. saveHotTopicAnalysis() JSDoc (Lines 468–486)**
- ✅ NEW: Detailed docstring explaining two-phase persistence:
  - **Phase 1:** Save to `WY_DB.civic_item_ai_tags` with reason_summary
  - **Phase 2:** Link to `EVENTS_DB.hot_topic_civic_items` junction table
- Example: reason_summary field with real-world example

**3. Future match_criteria_json Comment (Lines 520–524)**
- ✅ NEW: Forward-looking comment explaining match_criteria_json purpose
- Indicates planned usage for rule-based filtering (currently using OpenAI)

---

## Migration Application Commands

### Local Development

```bash
cd /home/anchor/projects/this-is-us/worker

# Apply WY_DB migrations
npx wrangler d1 migrations apply WY_DB --local

# Apply EVENTS_DB migrations  
npx wrangler d1 migrations apply EVENTS_DB --local

# Verify new columns exist
npx wrangler d1 execute WY_DB --local \
  --command "PRAGMA table_info(civic_item_ai_tags);" --json | jq

npx wrangler d1 execute EVENTS_DB --local \
  --command "PRAGMA table_info(hot_topics);" --json | jq
```

### Remote/Production

```bash
# Apply to production WY_DB
npx wrangler d1 migrations apply WY_DB --remote

# Apply to production EVENTS_DB
npx wrangler d1 migrations apply EVENTS_DB --remote
```

---

## Backward Compatibility

✅ **All changes are additive and backward-compatible:**

- **civic_item_ai_tags**: New `reason_summary` column defaults to NULL
  - Existing queries work unchanged
  - New code populates the field when available
  
- **hot_topics**: New `match_criteria_json` column defaults to NULL
  - Existing queries work unchanged
  - Future code can optionally use for rule-based filtering

✅ **No destructive changes:**
- No columns dropped or renamed
- No table recreations
- No type conversions

---

## Testing the Feature

### 1. After applying migrations locally:

```bash
# Scan pending bills with reason_summary capture
curl -X POST http://127.0.0.1:8787/api/internal/civic/scan-pending-bills | jq '.results[0]'

# Expected response includes reason_summary in topics:
# {
#   "bill_number": "HB 22",
#   "topics": [
#     {
#       "slug": "property-tax-relief",
#       "label": "Property Tax Relief",
#       "confidence": 0.92,
#       "trigger_snippet": "...",
#       "reason_summary": "This bill directly addresses..."
#     }
#   ]
# }
```

### 2. Verify database persistence:

```bash
npx wrangler d1 execute WY_DB --local \
  --command "SELECT item_id, topic_slug, reason_summary FROM civic_item_ai_tags LIMIT 1;" --json | jq
```

### 3. Check hot_topics schema:

```bash
npx wrangler d1 execute EVENTS_DB --local \
  --command "SELECT slug, match_criteria_json FROM hot_topics LIMIT 1;" --json | jq
```

---

## Summary Table

| Component | Change | Migration | Status |
|-----------|--------|-----------|--------|
| **civic_item_ai_tags** | Add `reason_summary TEXT` | `0010_add_reason_summary_to_civic_item_ai_tags.sql` | ✅ Applied |
| **hot_topics** | Add `match_criteria_json TEXT` | `0015_add_match_criteria_json_to_hot_topics.sql` | ✅ Created |
| **saveHotTopicAnalysis()** | Enhanced docs + reason_summary persistence | N/A | ✅ Documented |
| **Future filtering** | Reference implementation ready | N/A | ✅ Documented |

---

## Next Steps

1. **Apply locally:**
   ```bash
   npx wrangler d1 migrations apply WY_DB --local
   npx wrangler d1 migrations apply EVENTS_DB --local
   ```

2. **Test bill scanning:**
   - Run scan endpoint and verify reason_summary in response
   - Query database to confirm persistence

3. **Deploy to production:**
   ```bash
   npx wrangler d1 migrations apply WY_DB --remote
   npx wrangler d1 migrations apply EVENTS_DB --remote
   ```

4. **Future enhancements:**
   - Populate `match_criteria_json` via admin interface
   - Implement rule-based matching using criteria
   - Track match_criteria usage in analytics

---

**Created by:** Schema Refinement Session  
**Files Modified:** 3 (migrations/0015_add_match_criteria_json_to_hot_topics.sql, hotTopicsAnalyzer.mjs, tree.txt)  
**Git Commit:** 895fbbb
