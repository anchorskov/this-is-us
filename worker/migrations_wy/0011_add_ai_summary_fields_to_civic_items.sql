-- Migration: Add AI summary fields to civic_items for bill cards
-- Stores cached AI-generated summaries and key points to avoid repeated expensive API calls
-- 
-- Fields:
-- - ai_summary: Short 1-2 sentence plain-language summary for citizens
-- - ai_key_points: JSON array of 2-3 key impacts/changes (e.g., ["caps tax increases", "expands exemptions"])
-- - ai_summary_version: Hash/version of the summary (e.g., bill_text_hash) to detect when to refresh
-- - ai_summary_generated_at: Timestamp when AI summary was last generated
--
-- Strategy:
-- - Only generate once per bill_number + legislative_session combo (or per text version)
-- - Reuse for all card displays, bill detail pages, and API responses
-- - If bill_text changes (detected by version mismatch), regenerate

ALTER TABLE civic_items ADD COLUMN ai_summary TEXT;
ALTER TABLE civic_items ADD COLUMN ai_key_points TEXT;
ALTER TABLE civic_items ADD COLUMN ai_summary_version TEXT;
ALTER TABLE civic_items ADD COLUMN ai_summary_generated_at TEXT;
