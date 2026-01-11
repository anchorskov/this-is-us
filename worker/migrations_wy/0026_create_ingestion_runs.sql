-- worker/migrations_wy/0026_create_ingestion_runs.sql
-- Run log tables for wyoleg ingestion orchestration

CREATE TABLE IF NOT EXISTS ingestion_runs (
  run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  session TEXT,
  limit_requested INTEGER,
  force_flag INTEGER DEFAULT 0,
  dry_run INTEGER DEFAULT 0,
  synced_count INTEGER DEFAULT 0,
  scanned_count INTEGER DEFAULT 0,
  resolved_docs_count INTEGER DEFAULT 0,
  summaries_written INTEGER DEFAULT 0,
  tags_written INTEGER DEFAULT 0,
  status TEXT,
  error TEXT
);

CREATE TABLE IF NOT EXISTS ingestion_run_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  civic_item_id TEXT,
  bill_number TEXT,
  phase TEXT,
  status TEXT,
  message TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES ingestion_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_run_items_run ON ingestion_run_items(run_id);
