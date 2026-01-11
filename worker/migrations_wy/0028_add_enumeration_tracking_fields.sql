-- 0028_add_enumeration_tracking_fields.sql
-- Add delta-based enumeration fields to track bill lifecycle
-- last_seen_at: When this bill was last seen in LSO enumeration
-- inactive_at: When this bill was marked as inactive (no longer in LSO list)
-- enumerated_at: When this bill was enumerated from LSO

ALTER TABLE civic_items ADD COLUMN last_seen_at TEXT;
ALTER TABLE civic_items ADD COLUMN inactive_at TEXT;
ALTER TABLE civic_items ADD COLUMN enumerated_at TEXT;

-- Create indices for efficient queries on active bills
CREATE INDEX idx_civic_items_last_seen_at ON civic_items(last_seen_at);
CREATE INDEX idx_civic_items_inactive_at ON civic_items(inactive_at);
CREATE INDEX idx_civic_items_active ON civic_items(legislative_session, inactive_at) WHERE kind='bill' AND inactive_at IS NULL;
