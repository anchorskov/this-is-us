-- Migration: 0038_add_hot_topics_invalidated.sql
-- Purpose: add invalidated flag to hot topics tables

ALTER TABLE hot_topics ADD COLUMN invalidated INTEGER DEFAULT 0;
ALTER TABLE hot_topics_draft ADD COLUMN invalidated INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_hot_topics_invalidated ON hot_topics(invalidated);
