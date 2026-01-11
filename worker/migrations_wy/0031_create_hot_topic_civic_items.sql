-- Migration: 0031_create_hot_topic_civic_items.sql
-- Purpose: Create hot_topic_civic_items with confidence tracking in WY_DB

CREATE TABLE IF NOT EXISTS hot_topic_civic_items (
  topic_id INTEGER NOT NULL REFERENCES hot_topics(id),
  civic_item_id TEXT NOT NULL,
  confidence REAL,
  source TEXT,
  generated_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (topic_id, civic_item_id)
);

CREATE INDEX IF NOT EXISTS idx_hot_topic_civic_items_topic_id
ON hot_topic_civic_items(topic_id);

CREATE INDEX IF NOT EXISTS idx_hot_topic_civic_items_civic_item_id
ON hot_topic_civic_items(civic_item_id);

CREATE INDEX IF NOT EXISTS idx_hot_topic_civic_items_confidence
ON hot_topic_civic_items(topic_id, confidence DESC);
