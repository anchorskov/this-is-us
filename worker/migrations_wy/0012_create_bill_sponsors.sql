-- Migration: Create bill_sponsors table for Phase 2: Sponsors & Delegation
-- Tracks primary sponsors and cosponsors for bills with contact information
-- Enables "Who introduced this?" cards and future "Your delegation" lookups
--
-- Strategy:
-- - One row per sponsor-bill pair (bill can have multiple sponsors)
-- - sponsor_role: "primary" (first) or "cosponsor"
-- - contact_* fields are optional (may be NULL if legislator info incomplete)
-- - indices on (civic_item_id) for efficient bill→sponsors queries
-- - Created/updated timestamps for audit trail
--
-- Data flow:
-- - Populated manually or via OpenStates sync when it provides sponsor data
-- - Queried by bill detail page and future delegation preview cards

CREATE TABLE bill_sponsors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  civic_item_id TEXT NOT NULL,                -- FK to civic_items(id)
  sponsor_name TEXT NOT NULL,                 -- Full legislator name: "John Smith"
  sponsor_role TEXT NOT NULL,                 -- "primary" | "cosponsor" | "committee"
  sponsor_district TEXT,                      -- "HD-23" | "SF-10" | NULL for at-large
  chamber TEXT,                               -- "house" | "senate" (denormalized for speed)
  contact_email TEXT,                         -- legislator@wylegislature.gov (if available)
  contact_phone TEXT,                         -- Legislator's office phone (if available)
  contact_website TEXT,                       -- Link to legislator profile or website
  created_at TEXT NOT NULL,                   -- ISO 8601 timestamp
  updated_at TEXT NOT NULL,                   -- ISO 8601 timestamp for amendment tracking
  FOREIGN KEY (civic_item_id) REFERENCES civic_items(id) ON DELETE CASCADE
);

CREATE INDEX idx_bill_sponsors_civic_item ON bill_sponsors(civic_item_id);
CREATE INDEX idx_bill_sponsors_sponsor_name ON bill_sponsors(sponsor_name);
CREATE INDEX idx_bill_sponsors_district ON bill_sponsors(sponsor_district);
