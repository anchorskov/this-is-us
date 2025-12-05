-- Migration: Add match_criteria_json column to hot_topics
-- Stores flexible JSON with match criteria for future rule-based filtering
-- Example structure:
-- {
--   "title_keywords": ["property", "tax", "assessment"],
--   "summary_keywords": ["homeowner", "burden"],
--   "subject_tags": ["Tax Reform"],
--   "exclude_keywords": ["federal"],
--   "min_rule_score": 0.7
-- }

ALTER TABLE hot_topics ADD COLUMN match_criteria_json TEXT;
