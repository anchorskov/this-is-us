-- Migration: Create verified_users bridge table
-- Purpose: Gate Town Hall posting and voting to verified county voters
-- Date: 2025-12-09

CREATE TABLE IF NOT EXISTS verified_users (
  user_id TEXT PRIMARY KEY,
  voter_id TEXT NOT NULL UNIQUE,
  county TEXT,
  house TEXT,
  senate TEXT,
  verified_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'verified',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  
  FOREIGN KEY (voter_id) REFERENCES voters_addr_norm(voter_id) ON DELETE RESTRICT
);

-- Index on voter_id for reverse lookups (voter -> user)
CREATE INDEX IF NOT EXISTS idx_verified_users_voter_id ON verified_users(voter_id);

-- Index on status for efficient filtering of active verified records
CREATE INDEX IF NOT EXISTS idx_verified_users_status ON verified_users(status);

-- Composite index for common query pattern: user + status
CREATE INDEX IF NOT EXISTS idx_verified_users_user_status ON verified_users(user_id, status);
