-- Migration: add LSO hydration/completeness fields to civic_item_verification
-- These track whether we have LSO summary/text and the review gating state.

ALTER TABLE civic_item_verification ADD COLUMN has_lso_summary INTEGER;
ALTER TABLE civic_item_verification ADD COLUMN has_lso_text INTEGER;
ALTER TABLE civic_item_verification ADD COLUMN lso_text_source TEXT;
ALTER TABLE civic_item_verification ADD COLUMN review_status TEXT;

CREATE INDEX IF NOT EXISTS idx_civic_item_verification_lso_ready
  ON civic_item_verification(review_status, status);
