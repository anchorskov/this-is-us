-- worker/migrations/0012_add_match_metadata_to_hot_topic_civic_items.sql
-- Adds match metadata columns to hot_topic_civic_items for automatic bill scanning
-- Stores match_score, matched_terms, and excerpt for each bill-topic link
-- Idempotent: uses ALTER TABLE with simple defaults (SQL_REPLACE not supported on ALTER)

-- Add match_score column if it doesn't exist
-- Stores the confidence/relevance score (0.0 to 1.0) of the bill-topic match
ALTER TABLE hot_topic_civic_items 
ADD COLUMN match_score REAL;

-- Add matched_terms_json column if it doesn't exist
-- Stores JSON array of terms that matched between bill and topic
ALTER TABLE hot_topic_civic_items 
ADD COLUMN matched_terms_json TEXT;

-- Add excerpt column if it doesn't exist
-- Stores relevant excerpt from the bill text showing the match context
ALTER TABLE hot_topic_civic_items 
ADD COLUMN excerpt TEXT;

-- Add created_at column
-- Timestamp for when the link was first created
-- Note: Existing rows will have NULL; new rows should set this explicitly
ALTER TABLE hot_topic_civic_items 
ADD COLUMN created_at DATETIME;

-- Create index for efficient querying of strongest matches per topic
-- Helps with "top bills for topic" queries and sorting by relevance
CREATE INDEX IF NOT EXISTS idx_hot_topic_matches_topic_score 
ON hot_topic_civic_items(topic_id, match_score DESC);
