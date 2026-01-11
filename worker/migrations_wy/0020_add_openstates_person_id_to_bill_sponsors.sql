-- Migration: Add OpenStates person id to bill_sponsors for sponsor ingestion
-- Enables mapping sponsors pulled from OpenStates detail endpoint to local records

-- Add openstates_person_id column if it doesn't exist
ALTER TABLE bill_sponsors ADD COLUMN openstates_person_id TEXT;

CREATE INDEX IF NOT EXISTS idx_bill_sponsors_person_id
  ON bill_sponsors(openstates_person_id);
