-- Migration: Add summary source metadata fields to civic_items
-- Tracks the source of AI-generated summaries for debugging and transparency
--
-- Fields:
-- - summary_source: Enum source of text for summary (lso_html, text_url, pdf, openstates, title_only, none)
-- - summary_error: Enum error state if summary generation failed (api_error, parse_error, exception, empty_summary, no_text_available, ok)
-- - summary_is_authoritative: Boolean flag (0/1) indicating if source is authoritative (LSO, PDF, text_url=true; OpenStates=false)
--
-- Purpose:
-- - Debugging: Filter summaries by source to validate fallback ladder behavior
-- - Transparency: Show users whether summary came from official LSO/PDF or fallback OpenStates
-- - Quality control: Identify sources with high failure rates or thin text

ALTER TABLE civic_items ADD COLUMN summary_source TEXT DEFAULT 'none';
ALTER TABLE civic_items ADD COLUMN summary_error TEXT DEFAULT 'ok';
ALTER TABLE civic_items ADD COLUMN summary_is_authoritative INTEGER DEFAULT 1;

-- Add index on summary_source for filtering/reporting
CREATE INDEX idx_civic_items_summary_source ON civic_items(summary_source);
