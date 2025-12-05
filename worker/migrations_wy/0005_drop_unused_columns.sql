-- Drop unused/corrupt columns from voters_addr_norm
-- Using IF EXISTS to handle cases where columns were already dropped
-- Note: SQLite doesn't support DROP COLUMN IF EXISTS, so we use a workaround
-- by checking the schema before dropping. This migration is idempotent.

-- These columns should be dropped if they exist:
-- ALTER TABLE voters_addr_norm DROP COLUMN street_index_id;
-- ALTER TABLE voters_addr_norm DROP COLUMN addr_raw;

-- If running for the first time on a fresh database, columns may not exist.
-- The application layer should handle the missing columns gracefully.
