-- Migration: 0033_add_hot_topics_session_and_description.sql
-- Purpose: add legislative_session and description to hot_topics

ALTER TABLE hot_topics ADD COLUMN legislative_session TEXT;
ALTER TABLE hot_topics ADD COLUMN description TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hot_topics_session_slug
ON hot_topics(legislative_session, slug);
