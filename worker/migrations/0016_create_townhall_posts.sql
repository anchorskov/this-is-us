-- Migration number: 0016 	 2025-12-09T12:00:00.000Z
-- Purpose: Create townhall_posts table for Town Hall threads
-- NOTE: This table already exists in production (via manual creation).
-- This migration ensures consistency across local, preview, and new environments.

CREATE TABLE IF NOT EXISTS townhall_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT,
  created_at TEXT NOT NULL,
  r2_key TEXT,
  file_size INTEGER,
  expires_at TEXT,
  city TEXT DEFAULT '',
  state TEXT DEFAULT ''
);

-- Create index for faster queries by creation date (for pagination)
CREATE INDEX IF NOT EXISTS idx_townhall_posts_created_at ON townhall_posts(created_at DESC);

-- Create index for location-based filtering
CREATE INDEX IF NOT EXISTS idx_townhall_posts_city ON townhall_posts(city);
