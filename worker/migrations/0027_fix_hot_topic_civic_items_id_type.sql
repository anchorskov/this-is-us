-- Fix civic_item_id type to match composite IDs from WY_DB
-- civic_item_id should be TEXT to hold composite IDs like '2026_HB0001'

-- Create new table with correct schema
CREATE TABLE hot_topic_civic_items_new (
  topic_id INTEGER NOT NULL REFERENCES hot_topics(id),
  civic_item_id TEXT NOT NULL,
  match_score REAL,
  matched_terms_json TEXT,
  excerpt TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confidence REAL,
  source TEXT,
  generated_at DATETIME,
  PRIMARY KEY (topic_id, civic_item_id)
);

-- Migrate data (if any) - in this case there's no data yet
INSERT INTO hot_topic_civic_items_new 
SELECT * FROM hot_topic_civic_items;

-- Drop old table and rename new one
DROP TABLE hot_topic_civic_items;
ALTER TABLE hot_topic_civic_items_new RENAME TO hot_topic_civic_items;

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_hot_topic_matches_topic_score 
ON hot_topic_civic_items(topic_id, match_score DESC);
