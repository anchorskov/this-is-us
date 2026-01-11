-- Track resolved document sources (PDF/text) for civic items
CREATE TABLE IF NOT EXISTS civic_item_sources (
  civic_item_id TEXT PRIMARY KEY,
  best_doc_url TEXT,
  best_doc_kind TEXT,
  status TEXT,
  checked_at TEXT,
  last_error TEXT
);
