-- Migration: 0034_add_hot_topic_civic_items_session_index.sql
-- Purpose: add legislative_session and unique index to hot_topic_civic_items

ALTER TABLE hot_topic_civic_items ADD COLUMN legislative_session TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hot_topic_links_session_topic_bill
ON hot_topic_civic_items(legislative_session, topic_id, civic_item_id);
