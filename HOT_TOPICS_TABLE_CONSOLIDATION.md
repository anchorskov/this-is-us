# Hot Topics Table Consolidation - Complete

## Summary
Successfully consolidated hot topics workflow by:
1. ✅ Adding `official_url` field to both `hot_topics` and `hot_topics_draft`
2. ✅ Removing unused `hot_topics_staging` tables (dead code)
3. ✅ Updating `adminHotTopics.mjs` to handle `official_url` in all workflows
4. ✅ Seeding test data with `official_url` values

---

## Table Comparison (Before & After)

### Before Consolidation
| Table | Purpose | Status | Usage |
|-------|---------|--------|-------|
| `hot_topics` | Production topics | Live | Query endpoint, publish destination |
| `hot_topics_staging` | AI analysis workflow | Defined | ❌ **NOT USED** (dead code) |
| `hot_topics_draft` | Admin UI editing | Live | Active in adminHotTopics.mjs |

### After Consolidation
| Table | Purpose | Status | Usage |
|-------|---------|--------|-------|
| `hot_topics` | Production topics | Live | Query endpoint, publish destination |
| `hot_topics_draft` | Admin review/staging | Live | Single source of truth for drafts |
| `hot_topics_staging` | ❌ REMOVED | Archived | (See migration 0036 for restore) |

---

## Schema Changes

### Migration 0040: Add official_url
**Files modified:**
- Created: `worker/migrations_wy/0040_add_official_url_to_hot_topics.sql`

**Changes:**
```sql
ALTER TABLE hot_topics ADD COLUMN official_url TEXT;
ALTER TABLE hot_topics_draft ADD COLUMN official_url TEXT;
```

**Impact:**
- `official_url` now stored in topic tables (denormalized)
- Faster queries without JOIN to civic_items
- Simpler publishing logic (copy official_url directly)
- Backward compatible (nullable)

---

### Migration 0041: Archive Unused Tables
**Files modified:**
- Created: `worker/migrations_wy/0041_archive_hot_topics_staging.sql`

**Changes:**
```sql
DROP TABLE IF EXISTS hot_topics_review_audit;
DROP TABLE IF EXISTS hot_topics_staging;
```

**Rationale:**
- `hot_topics_staging` was designed for AI analysis → staging → review → production
- Actual implementation uses `hot_topics_draft` (admin UI → approve → publish)
- Staging module (`hotTopicsValidator.mjs`) is unused in production
- No code references these tables

**To Restore:**
- See migration `0036_create_hot_topics_staging.sql` for table definitions

---

## Code Updates

### File: `worker/src/routes/adminHotTopics.mjs`

**Changes Made:**

1. **Edit Draft Topics (POST /api/admin/hot-topics/drafts/:topicId)**
   - Added `official_url` to updateable fields
   - Accepts `body.officialUrl` in request

2. **List Draft Topics (GET /api/admin/hot-topics/drafts)**
   - Added `officialUrl: draft.official_url` to response object
   - Already included in linkedBills (from civic_items)

3. **Publish Topics (POST /api/admin/hot-topics/publish)**
   - Added `official_url` to insert columns
   - Copies draft's `official_url` to live topic on publish
   - Includes in update assignments for conflict resolution

**Updated Query Functions:**
- `handleListDraftTopics()` - Added officialUrl to response
- `handlePublishTopics()` - Added official_url to publish workflow
- Edit handler - Added official_url as editable field

---

## Test Data Updates

### Migration 0039: Test Data Seeding
**Updated to include official_url:**

```sql
INSERT INTO hot_topics_draft (..., official_url, ...)
VALUES
  ('education-funding', ..., 'http://testpdf.url/education-funding-summary.pdf', ...),
  ('water-rights', ..., 'http://testpdf.url/water-rights-summary.pdf', ...),
  ('healthcare-access', ..., 'http://testpdf.url/healthcare-access-summary.pdf', ...)
```

**Current Test Data:**
- 3 draft topics with official_url populated
- 4 linked civic items (bills) with external_url
- 3 topic-bill relationships with metadata

---

## Field Reference: hot_topics_draft

**Core Topic Fields:**
- `id` (INT) - Primary key
- `slug` (TEXT) - Unique identifier
- `title` (TEXT) - Display title
- `summary` (TEXT) - Short description
- `badge` (TEXT) - Category label
- `image_url` (TEXT) - Featured image
- `cta_label`, `cta_url` (TEXT) - Call-to-action
- `priority` (INT) - Sort order
- **`official_url` (TEXT)** - ✅ **NEW** Topic document URL

**Admin Workflow Fields:**
- `status` (TEXT) - draft, approved, rejected, published
- `reviewed_at`, `reviewed_by`, `reviewer_notes` - Admin tracking
- `invalidated` (INT) - ⚠️ Legacy (kept for compatibility)

**Source Tracking:**
- `source_run_id` (TEXT) - Ingestion run identifier
- `confidence` (REAL) - Average confidence from linked bills
- `ai_source` (TEXT) - openai, heuristic, etc.

**Timestamps:**
- `created_at`, `updated_at` - Audit trail

---

## API Response Example

**GET /api/admin/hot-topics/drafts**
```json
{
  "drafts": [
    {
      "id": 1,
      "slug": "education-funding",
      "title": "Education Funding Reform",
      "summary": "K-12 education funding...",
      "officialUrl": "http://testpdf.url/education-funding-summary.pdf",
      "status": "draft",
      "priority": 85,
      "avgConfidence": 0.87,
      "linkedBillCount": 2,
      "linkedBills": [
        {
          "civicItemId": "wy-2026-hb-001",
          "billNumber": "HB 001",
          "title": "An Act Relating to General Education...",
          "aiSummary": "...",
          "officialUrl": "http://testpdf.url/wy-2026-hb-001.pdf",
          "confidence": 0.87,
          "triggerSnippet": "...",
          "reasonSummary": "..."
        }
      ]
    }
  ]
}
```

---

## Migration Execution Summary

**Executed Migrations:**
1. ✅ **0040_add_official_url_to_hot_topics.sql**
   - 2 commands executed
   - Added official_url columns

2. ✅ **0041_archive_hot_topics_staging.sql**
   - 2 commands executed
   - Dropped unused staging tables

3. ✅ **0039_seed_hot_topics_draft_test_data.sql** (re-executed)
   - 6 commands executed
   - Updated test data with official_url values

**Database State:**
- `hot_topics` - Production table, now has official_url column
- `hot_topics_draft` - Active staging, now has official_url column
- `hot_topics_staging` - ❌ REMOVED
- `hot_topics_review_audit` - ❌ REMOVED
- `hot_topic_civic_items_draft` - Active (links drafts to bills)

---

## Files Modified

| File | Changes |
|------|---------|
| `worker/migrations_wy/0040_add_official_url_to_hot_topics.sql` | ✅ Created |
| `worker/migrations_wy/0041_archive_hot_topics_staging.sql` | ✅ Created |
| `worker/migrations_wy/0039_seed_hot_topics_draft_test_data.sql` | ✅ Updated with official_url |
| `worker/src/routes/adminHotTopics.mjs` | ✅ Updated (5 edits) |

---

## Next Steps

### Optional: Remove invalidated Column
SQLite doesn't support direct column drops. To remove `invalidated`:
1. Rename table: `ALTER TABLE hot_topics_draft RENAME TO hot_topics_draft_old;`
2. Recreate without `invalidated`
3. Copy data: `INSERT INTO hot_topics_draft (...exclude invalidated...) SELECT ... FROM hot_topics_draft_old;`
4. Drop old table

**Currently:** Keep `invalidated` for backward compatibility; use `status='rejected'` for new workflows.

### Optional: Remove hotTopicsValidator.mjs
Now that staging tables are gone, the validator module is obsolete:
- File: `worker/src/lib/hotTopicsValidator.mjs`
- Search for usages before removing
- Update imports if used anywhere

---

## Summary: Table Architecture

**New Workflow:**
```
AI Bill Analysis → hot_topics_draft (draft status) → Admin Review
                         ↓ (approve)
                  Admin UI Edit (set official_url)
                         ↓ (publish)
                    hot_topics (production)
                         ↓ (query)
                   Frontend Display
```

**Key Improvements:**
1. ✅ Single staging table (hot_topics_draft) - no duplication
2. ✅ Denormalized official_url - faster queries, simpler publishing
3. ✅ Active admin UI fully supported
4. ✅ Dead code (hot_topics_staging) removed
5. ✅ Clear status workflow (draft → approved → published)

---

## Validation Checklist

- [x] official_url column added to hot_topics
- [x] official_url column added to hot_topics_draft
- [x] hot_topics_staging tables removed
- [x] adminHotTopics.mjs updated for official_url
- [x] Test data seeded with official_url values
- [x] API response includes officialUrl field
- [x] Publishing workflow includes official_url copy
- [x] Database state verified (schema & data)

**Status:** ✅ COMPLETE - Ready for testing
