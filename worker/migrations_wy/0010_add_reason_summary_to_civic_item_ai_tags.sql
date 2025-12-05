-- Add reason_summary column to civic_item_ai_tags
-- Captures AI explanation of why a bill matches a hot topic
ALTER TABLE civic_item_ai_tags ADD COLUMN reason_summary TEXT;
