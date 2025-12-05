-- worker/migrations_wy/0006_create_civic_items.sql
-- Create civic_items table for tracking bills, local issues, and ballot measures

CREATE TABLE civic_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  level TEXT NOT NULL,
  jurisdiction_key TEXT NOT NULL,
  bill_number TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL,
  legislative_session TEXT,
  chamber TEXT,
  ballot_type TEXT,
  measure_code TEXT,
  election_date TEXT,
  external_ref_id TEXT,
  external_url TEXT,
  text_url TEXT,
  category TEXT,
  subject_tags TEXT,
  location_label TEXT,
  introduced_at TEXT,
  last_action TEXT,
  last_action_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  up_votes INTEGER NOT NULL DEFAULT 0,
  down_votes INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_civic_items_scope ON civic_items(level, jurisdiction_key);
CREATE INDEX idx_civic_items_kind_status ON civic_items(kind, status);
CREATE INDEX idx_civic_items_category ON civic_items(category);
