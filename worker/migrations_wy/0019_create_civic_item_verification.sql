/**
 * Create civic_item_verification table for AI verification results.
 * 
 * This table stores the results of AI verification checks on bill metadata.
 * The internalVerifyBill route runs a gpt-4o-mini check to confirm that:
 *   1. The stored topic matches the bill title/abstract.
 *   2. The AI-generated summary doesn't make unsupported claims.
 * 
 * The pendingBills route uses the LATEST verification row (max created_at)
 * for each civic_item_id to populate verification_status and verification_confidence
 * fields in the API response.
 * 
 * Columns:
 *   - id: Primary key (auto-increment for history tracking).
 *   - civic_item_id: FK to civic_items.id (NOT NULL).
 *   - check_type: Type of verification (e.g., 'topic_summary'). Currently always 'topic_summary'.
 *   - topic_match: 1 = topic matches bill title/abstract, 0 = mismatch.
 *   - summary_safe: 1 = summary claims consistent with title/abstract, 0 = unsafe/inconsistent.
 *   - issues: JSON string containing array of issue descriptions found during verification.
 *   - model: Model name used for verification (e.g., 'gpt-4o-mini').
 *   - confidence: Confidence score from model (0.0 to 1.0).
 *   - status: Verification status ('ok' = both topic_match and summary_safe are true, 'flagged' otherwise).
 *   - created_at: ISO-8601 timestamp of when this verification was run.
 * 
 * Indexes:
 *   - civic_item_id + created_at for finding the latest verification per bill.
 *   - status for filtering flagged bills.
 * 
 * Note: We use AUTO ROWID (implicit SQLite rowid) for id. The ON CONFLICT clause
 * in internalVerifyBill.mjs uses (civic_item_id, check_type) as the conflict target
 * to ensure only one active verification per bill per check type.
 */

CREATE TABLE IF NOT EXISTS civic_item_verification (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  civic_item_id INTEGER NOT NULL,
  check_type TEXT NOT NULL,
  topic_match INTEGER NOT NULL,
  summary_safe INTEGER NOT NULL,
  issues TEXT,
  model TEXT NOT NULL,
  confidence REAL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Index for finding the latest verification per civic_item (used by pendingBills)
CREATE INDEX IF NOT EXISTS idx_civic_item_verification_latest
  ON civic_item_verification(civic_item_id, created_at DESC);

-- Index for filtering flagged bills
CREATE INDEX IF NOT EXISTS idx_civic_item_verification_status
  ON civic_item_verification(status);

-- Unique constraint to ensure only one active verification per (civic_item_id, check_type)
-- Used by internalVerifyBill.mjs ON CONFLICT clause
CREATE UNIQUE INDEX IF NOT EXISTS idx_civic_item_verification_unique
  ON civic_item_verification(civic_item_id, check_type);
