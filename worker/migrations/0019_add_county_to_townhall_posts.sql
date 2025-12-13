-- Migration number: 0019 	 2025-12-10T14:05:00.000Z
-- Purpose: Add county column to townhall_posts for better location tracking
-- Enables county-level filtering and linking to WY_DB.verified_users for verification

ALTER TABLE townhall_posts ADD COLUMN county TEXT;

-- Index for county-based filtering and potential county-level town halls
CREATE INDEX IF NOT EXISTS idx_townhall_posts_county
  ON townhall_posts(county);

-- Composite index for common filtering pattern: county + status (if status added later)
CREATE INDEX IF NOT EXISTS idx_townhall_posts_county_created_at
  ON townhall_posts(county, created_at DESC);
