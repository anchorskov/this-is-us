-- Migration: 0036_create_hot_topics_staging.sql
-- Purpose: Create staging table and audit log for hot topics review workflow
-- Description: Implements a review gate between AI analysis and production publication
-- 
-- Workflow:
--   1. AI analyzer writes topics to hot_topics_staging (with validation metadata)
--   2. Admin reviews staging records via CLI
--   3. Admin approves/rejects each record
--   4. Approved records promoted to production hot_topics table
--   5. Audit log tracks all review decisions

-- ════════════════════════════════════════════════════════════════════════════════
-- TABLE: hot_topics_staging
-- ════════════════════════════════════════════════════════════════════════════════
-- Temporary holding table for all AI-generated hot topics before admin review.
-- Only records with is_complete=1 and review_status='approved' should be promoted.

CREATE TABLE IF NOT EXISTS hot_topics_staging (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- ─────────────────────────────────────────────────────────────────────────
  -- Core topic metadata (from AI analysis or manual entry)
  -- ─────────────────────────────────────────────────────────────────────────
  slug TEXT NOT NULL,                    -- Canonical identifier (e.g., "property-tax-relief")
  title TEXT NOT NULL,                   -- Human-readable title
  summary TEXT,                          -- Short description (1-2 sentences)
  badge TEXT,                            -- Category/label (e.g., "Taxes", "Health")
  image_url TEXT,                        -- Featured image URL for topic card
  cta_label TEXT,                        -- Call-to-action button text
  cta_url TEXT,                          -- Call-to-action destination URL
  priority INTEGER DEFAULT 100,          -- Display sort order (lower = higher priority)
  
  -- ─────────────────────────────────────────────────────────────────────────
  -- Source bill linking (where this topic was detected)
  -- ─────────────────────────────────────────────────────────────────────────
  civic_item_id TEXT,                    -- FK to civic_items.id (the bill that triggered this)
  confidence REAL,                       -- AI confidence score (0.0 = low, 1.0 = certain)
  trigger_snippet TEXT,                  -- Direct quote/paraphrase from bill text
  reason_summary TEXT,                   -- Explanation: "This bill matches because..." (1-3 sentences)
  ai_source TEXT DEFAULT 'openai',       -- Source of analysis: 'openai' (Claude/GPT), 'heuristic' (rule-based)
  
  -- ─────────────────────────────────────────────────────────────────────────
  -- Review workflow status
  -- ─────────────────────────────────────────────────────────────────────────
  review_status TEXT DEFAULT 'pending',  -- pending | approved | rejected | requires_edit | promoted
  reviewer_notes TEXT,                   -- Admin comments during review (e.g., rejection reason)
  reviewed_by TEXT,                      -- Admin username/email who last reviewed
  reviewed_at DATETIME,                  -- Timestamp of last review action
  
  -- ─────────────────────────────────────────────────────────────────────────
  -- Validation metadata
  -- ─────────────────────────────────────────────────────────────────────────
  is_complete INTEGER DEFAULT 0,         -- 1 = all required fields present; 0 = missing data
  validation_errors TEXT,                -- JSON array of validation issues found
  
  -- ─────────────────────────────────────────────────────────────────────────
  -- Session and tracking
  -- ─────────────────────────────────────────────────────────────────────────
  legislative_session TEXT,              -- Session identifier (e.g., "2026")
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (civic_item_id) REFERENCES civic_items(id)
);

-- Create indexes for hot_topics_staging
CREATE INDEX IF NOT EXISTS idx_staging_status ON hot_topics_staging(review_status);
CREATE INDEX IF NOT EXISTS idx_staging_session ON hot_topics_staging(legislative_session);
CREATE INDEX IF NOT EXISTS idx_staging_complete ON hot_topics_staging(is_complete);
CREATE INDEX IF NOT EXISTS idx_staging_created ON hot_topics_staging(created_at);

-- ════════════════════════════════════════════════════════════════════════════════
-- TABLE: hot_topics_review_audit
-- ════════════════════════════════════════════════════════════════════════════════
-- Immutable audit log of all review actions (approve, reject, promote, edit).
-- Used for accountability, debugging, and compliance tracking.

CREATE TABLE IF NOT EXISTS hot_topics_review_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  staging_id INTEGER NOT NULL,           -- FK to hot_topics_staging.id
  action TEXT NOT NULL,                  -- reviewed | approved | rejected | promoted | edited
  previous_status TEXT,                  -- Status before this action
  new_status TEXT,                       -- Status after this action
  
  reviewer_name TEXT,                    -- Username/email of admin who performed action
  reviewer_email TEXT,                   -- Backup email field
  action_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,                            -- Detailed comment (e.g., rejection reason, edit notes)
  
  FOREIGN KEY (staging_id) REFERENCES hot_topics_staging(id)
);

-- Create indexes for hot_topics_review_audit
CREATE INDEX IF NOT EXISTS idx_audit_staging ON hot_topics_review_audit(staging_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON hot_topics_review_audit(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON hot_topics_review_audit(action_timestamp);

-- ════════════════════════════════════════════════════════════════════════════════
-- VALIDATION & COMPLETENESS RULES (Documented for app logic)
-- ════════════════════════════════════════════════════════════════════════════════
--
-- A record is "complete" and ready for promotion if ALL required fields are present:
--
-- REQUIRED (must be non-null and non-empty):
--   - slug               (canonical topic identifier)
--   - title              (human-readable topic title)
--   - confidence         (0.0–1.0 score from AI)
--   - trigger_snippet    (quoted text from bill)
--   - reason_summary     (explanation of match)
--
-- RECOMMENDED (should be populated):
--   - summary            (short description)
--   - badge              (category label)
--
-- OPTIONAL (can be null):
--   - image_url          (featured image – can be added by design team later)
--   - cta_label          (call-to-action button text – defaults to "Learn More")
--   - cta_url            (button destination – defaults to /hot-topics/{slug})
--   - priority           (defaults to 100)
--
-- During promotion, missing optional fields are populated with sensible defaults
-- OR fields are inherited from existing hot_topics records with same slug.

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ════════════════════════════════════════════════════════════════════════════════

-- Count pending topics awaiting review
-- SELECT COUNT(*) as pending_count FROM hot_topics_staging WHERE review_status = 'pending';

-- List incomplete records that need editing
-- SELECT id, slug, title, validation_errors FROM hot_topics_staging 
--  WHERE review_status = 'pending' AND is_complete = 0;

-- Show all reviews for a specific staging record
-- SELECT * FROM hot_topics_review_audit WHERE staging_id = 42 ORDER BY action_timestamp DESC;

-- Count by review status
-- SELECT review_status, COUNT(*) as count FROM hot_topics_staging GROUP BY review_status;

-- Find records ready to promote (approved + complete)
-- SELECT id, slug, title, confidence FROM hot_topics_staging 
--  WHERE review_status = 'approved' AND is_complete = 1 ORDER BY created_at ASC;

-- ════════════════════════════════════════════════════════════════════════════════
-- APPLIED
-- ════════════════════════════════════════════════════════════════════════════════
