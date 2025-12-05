-- Adds match metadata columns to hot_topic_civic_items for automatic bill scanning
-- Stores match_score, matched_terms, and excerpt for each bill-topic link
-- Note: created_at already exists on production, so we only add the new columns

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

-- Create index for efficient querying of strongest matches per topic
-- Helps with "top bills for topic" queries and sorting by relevance
CREATE INDEX IF NOT EXISTS idx_hot_topic_matches_topic_score 
ON hot_topic_civic_items(hot_topic_id, match_score DESC);
