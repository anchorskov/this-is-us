-- Migration: Add civic_item_sources table for document URL provenance
-- Date: 2025-12-15
-- Purpose: Store resolved PDF URLs and resolution metadata for Wyoming bills

CREATE TABLE IF NOT EXISTS civic_item_sources (
  civic_item_id TEXT PRIMARY KEY,
  best_doc_url TEXT,                          -- Best resolved PDF URL
  best_doc_kind TEXT,                         -- "introduced" | "engrossed" | "enrolled" | "fiscal"
  status TEXT NOT NULL DEFAULT 'pending',     -- "pending" | "resolved" | "not_found" | "error"
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),  -- When last checked
  notes TEXT,                                 -- Resolution notes or candidates found
  last_error TEXT,                            -- Last error message if resolution failed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for quick lookups by status
CREATE INDEX IF NOT EXISTS civic_item_sources_status ON civic_item_sources(status, checked_at);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS civic_item_sources_update_timestamp
AFTER UPDATE ON civic_item_sources
BEGIN
  UPDATE civic_item_sources SET updated_at = datetime('now') WHERE civic_item_id = NEW.civic_item_id;
END;
