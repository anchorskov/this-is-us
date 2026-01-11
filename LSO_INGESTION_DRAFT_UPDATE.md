# LSO Ingestion Process - Updated to Use hot_topics_draft

## Summary

Updated the LSO bill ingestion pipeline to write to `hot_topics_draft` instead of `hot_topics`. This aligns with the new architecture where:
- **Draft/Staging**: `hot_topics_draft` ← AI-generated topics from bill analysis (needs admin review)
- **Production**: `hot_topics` ← Approved and published topics

---

## Changes Made

### File: `worker/src/lib/billSummaryAnalyzer.mjs`

**Function**: `ensureHotTopicForBill(env, dbOverride, civicItem)`

#### What Changed

1. **Smart Table Detection**
   - Checks for draft tables first: `hot_topics_draft` and `hot_topic_civic_items_draft`
   - Falls back to production tables if draft tables don't exist
   - This ensures backward compatibility

2. **Dynamic Column Handling**
   - Detects available columns in the target table
   - Only writes columns that exist (e.g., `status`, `ai_source`, `source_run_id` for draft)
   - Omits production-only fields from draft table

3. **Draft-Specific Fields**
   ```javascript
   // For draft table:
   - status: 'draft'
   - ai_source: 'openai' or 'heuristic'
   - source_run_id: null (can be set by orchestration)
   
   // For production table (fallback):
   - is_active: 1
   - generated_at: current timestamp
   ```

4. **Link Table Updates**
   - Draft links include: `ai_source`, `trigger_snippet`, `reason_summary`
   - Production links include: `source`, `generated_at`
   - Trigger snippet and reason summary left as NULL initially (filled during admin review)

#### Code Flow

```javascript
// 1. Detect table availability
const hasDraftTopics = await hasTable(db, "hot_topics_draft");
const hasDraftLinks = await hasTable(db, "hot_topic_civic_items_draft");

// 2. Use draft if available, otherwise production
const useDraft = hasDraftTopics && hasDraftLinks;
const topicsTable = useDraft ? "hot_topics_draft" : "hot_topics";
const linksTable = useDraft ? "hot_topic_civic_items_draft" : "hot_topic_civic_items";

// 3. Insert with appropriate fields for the target table
if (useDraft && hasStatus) {
  columns.push("status");
  values.push("draft");
}

// 4. Return result with target table info
return {
  status: "created",
  target_table: topicsTable,  // ← NEW: shows which table was used
  ...
};
```

---

## Database Flow

### When LSO Bills Are Scanned

```
LSO Bill Enumeration/Scan
    ↓
    ├─→ Generate AI Summary (billSummaryAnalyzer)
    ├─→ Extract Key Points
    ├─→ Call OpenAI for Topics
    ↓
    └─→ ensureHotTopicForBill()
        ├─→ INSERT INTO hot_topics_draft (NEW!)
        │   └─ Fields: slug, title, summary, priority, status='draft', ai_source, source_run_id
        ├─→ INSERT INTO hot_topic_civic_items_draft
        │   └─ Fields: topic_id, civic_item_id, confidence, ai_source, trigger_snippet=NULL, reason_summary=NULL
        ↓
        ✅ Topics ready for admin review in Admin UI
```

### Admin Workflow

```
Admin UI (http://localhost:1313/admin/hot-topics)
    ↓
    Shows: hot_topics_draft records with status='draft'
    ↓
    Admin Actions:
    ├─→ Edit: Update title, summary, official_url, etc.
    ├─→ Approve: Set status='approved'
    ├─→ Publish: COPY to hot_topics (production)
    └─→ Reject: Set status='rejected'
```

---

## Table Comparison

| Aspect | hot_topics | hot_topics_draft |
|--------|-----------|-----------------|
| **Purpose** | Production topics | Admin review/staging |
| **Population** | Admin publish action | LSO ingestion process |
| **Status Field** | N/A | draft, approved, rejected, published |
| **AI Source** | N/A | openai, heuristic |
| **Source Run ID** | N/A | Links to ingestion run |
| **is_active** | 1 (default) | N/A |
| **Official URL** | Yes | Yes (editable by admin) |

---

## Backward Compatibility

✅ **Safe for Gradual Rollout**

- If `hot_topics_draft` doesn't exist, code falls back to `hot_topics`
- Existing production setups continue to work unchanged
- No data loss if migration hasn't run yet

---

## Entry Points

**LSO ingestion calls this function via:**
1. `worker/src/routes/civicScan.mjs:263` - Single bill test endpoint
2. `worker/src/routes/civicScan.mjs:413` - Batch scan endpoint

**Both routes now write to `hot_topics_draft` instead of `hot_topics`**

---

## Testing Recommendations

1. **Local Development**
   - Run LSO ingestion: `POST /api/internal/civic/scan-pending-bills`
   - Check: `hot_topics_draft` should have new records with `status='draft'`
   - Verify: Admin UI shows topics in draft review table

2. **Admin UI Test**
   - Navigate to: http://localhost:1313/admin/hot-topics
   - View draft topics (should be empty until you run ingestion)
   - Edit one (modify title/official_url)
   - Approve → Publish → verify in production

3. **Verification Query**
   ```sql
   SELECT id, slug, title, status, ai_source, created_at 
   FROM hot_topics_draft 
   WHERE status = 'draft'
   ORDER BY created_at DESC;
   ```

---

## What Stays the Same

✅ Bill summary analysis (unchanged)
✅ OpenAI integration (unchanged)
✅ Confidence scoring (unchanged)
✅ Fallback heuristic topics (unchanged)
✅ Production hot_topics for published content (unchanged)

---

## Future: Integration with Full Workflow

Once complete, the workflow will be:
```
Bills Enumerated → Summary Generated → Topics in Draft → Admin Review → Published
```

Currently supports draft generation; admin review and publishing already implemented.
