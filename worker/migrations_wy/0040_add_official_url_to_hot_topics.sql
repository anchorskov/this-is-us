-- Migration 0040: Add official_url to hot_topics and hot_topics_draft
-- Purpose: Denormalize bill URLs for faster queries and cleaner publishing logic
-- 
-- Changes:
--   1. Add official_url to hot_topics (production table)
--   2. Add official_url to hot_topics_draft (draft/staging table)
--   3. Remove invalidated column from hot_topics_draft (use status='rejected' instead)

-- ════════════════════════════════════════════════════════════════════════════════
-- 1. hot_topics table: Add official_url field
-- ════════════════════════════════════════════════════════════════════════════════
ALTER TABLE hot_topics ADD COLUMN official_url TEXT;

-- ════════════════════════════════════════════════════════════════════════════════
-- 2. hot_topics_draft table: Add official_url field
-- ════════════════════════════════════════════════════════════════════════════════
ALTER TABLE hot_topics_draft ADD COLUMN official_url TEXT;

-- ════════════════════════════════════════════════════════════════════════════════
-- 3. Migration guide for invalidated removal
-- ════════════════════════════════════════════════════════════════════════════════
-- NOTE: SQLite does not support dropping columns directly. If invalidated needs removal:
--   1. Rename table: ALTER TABLE hot_topics_draft RENAME TO hot_topics_draft_old;
--   2. Recreate without invalidated column
--   3. Copy data: INSERT INTO hot_topics_draft (...columns except invalidated...) SELECT ... FROM hot_topics_draft_old;
--   4. Drop old table
-- For now, invalidated is left in place (backwards compatible; use status='rejected' for new records)

-- ════════════════════════════════════════════════════════════════════════════════
-- Indexes for official_url (if querying by URL)
-- ════════════════════════════════════════════════════════════════════════════════
-- (Optional) Create indexes if needed for URL-based lookups
-- CREATE INDEX idx_hot_topics_official_url ON hot_topics(official_url);
-- CREATE INDEX idx_hot_topics_draft_official_url ON hot_topics_draft(official_url);
