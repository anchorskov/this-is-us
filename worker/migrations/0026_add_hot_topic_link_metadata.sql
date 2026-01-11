-- Add metadata to hot_topic_civic_items for confidence/source tracking

ALTER TABLE hot_topic_civic_items ADD COLUMN confidence REAL;
ALTER TABLE hot_topic_civic_items ADD COLUMN source TEXT;
ALTER TABLE hot_topic_civic_items ADD COLUMN generated_at DATETIME;
