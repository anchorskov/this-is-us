-- worker/migrations_wy/0027_create_ingestion_metadata.sql
-- Metadata storage for ingestion tracking and completeness verification
-- Uses a key-value pattern to flexibly store session counts without schema changes

CREATE TABLE IF NOT EXISTS ingestion_metadata (
  key TEXT PRIMARY KEY,
  value_text TEXT,
  value_int INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient lookups by session
CREATE INDEX IF NOT EXISTS idx_ingestion_metadata_key ON ingestion_metadata(key);
