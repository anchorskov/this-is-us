-- Migration: Create hot topic cards + bill attachment join table
-- Tables:
--   hot_topics             – Rich card metadata for public display
--   hot_topic_civic_items  – Optional link to civic_items (bills) for later use

-- Note: hot_topics table already exists on production with different schema
-- This migration is now a no-op to maintain compatibility
-- The existing table will be left in place

-- Join table for attaching civic_items (bills) if it doesn't exist
CREATE TABLE IF NOT EXISTS hot_topic_civic_items (
  topic_id INTEGER NOT NULL,
  civic_item_id INTEGER NOT NULL,
  PRIMARY KEY (topic_id, civic_item_id)
);
