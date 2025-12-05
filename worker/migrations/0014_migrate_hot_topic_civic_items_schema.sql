-- Migration: Migrate hot_topic_civic_items table to new schema
-- Drops old table and recreates with correct field names and structure
-- Uses compound primary key (topic_id, civic_item_id) instead of separate id

-- Temporarily disable foreign key constraints to allow table recreation
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS hot_topic_civic_items;

-- Create hot_topic_civic_items with correct schema
CREATE TABLE hot_topic_civic_items (
  topic_id INTEGER NOT NULL REFERENCES hot_topics(id),
  civic_item_id INTEGER NOT NULL,
  match_score REAL,
  matched_terms_json TEXT,
  excerpt TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (topic_id, civic_item_id)
);

-- Re-enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Create index for efficient querying of strongest matches per topic
CREATE INDEX idx_hot_topic_matches_topic_score 
ON hot_topic_civic_items(topic_id, match_score DESC);
