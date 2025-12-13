-- Migration: Add structural gating fields to civic_item_verification
-- Tracks Wyoming/source/summary prechecks alongside AI model verdict
-- NOTE: Columns already exist in schema (added manually previously)

-- ALTER TABLE civic_item_verification ADD COLUMN is_wyoming INTEGER;
-- ALTER TABLE civic_item_verification ADD COLUMN has_summary INTEGER;
-- ALTER TABLE civic_item_verification ADD COLUMN has_wyoming_sponsor INTEGER;
-- ALTER TABLE civic_item_verification ADD COLUMN structural_ok INTEGER;
-- ALTER TABLE civic_item_verification ADD COLUMN structural_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_civic_item_verification_structural
  ON civic_item_verification(structural_ok, status);
