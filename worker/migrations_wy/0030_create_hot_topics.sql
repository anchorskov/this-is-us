-- Migration: 0030_create_hot_topics.sql
-- Purpose: Create hot_topics for WY_DB civic topic storage

CREATE TABLE IF NOT EXISTS hot_topics (
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
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_hot_topics_updated
AFTER UPDATE ON hot_topics
BEGIN
  UPDATE hot_topics
     SET updated_at = CURRENT_TIMESTAMP
   WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_hot_topics_active_priority
ON hot_topics(is_active, priority);
