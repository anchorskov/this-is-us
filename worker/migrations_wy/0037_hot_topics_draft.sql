-- Migration 0037: Hot Topics Draft Tables
-- Create draft/staging tables for hot topics admin review workflow
-- Before publishing, topics are held in draft state for admin approval

-- Create draft topics table
CREATE TABLE IF NOT EXISTS hot_topics_draft (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  badge TEXT,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  priority INTEGER DEFAULT 100,
  
  -- Metadata for review
  status TEXT DEFAULT 'draft', -- draft, approved, rejected, published
  confidence REAL DEFAULT 0.0, -- Average confidence from linked bills
  
  -- Source tracking
  source_run_id TEXT, -- Identifies which ingestion run created this
  ai_source TEXT DEFAULT 'openai',
  
  -- Admin review tracking
  reviewed_at TIMESTAMP,
  reviewed_by TEXT, -- Admin user name
  reviewer_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for status (used in listing pending drafts)
CREATE INDEX IF NOT EXISTS idx_draft_status ON hot_topics_draft(status);
CREATE INDEX IF NOT EXISTS idx_draft_created ON hot_topics_draft(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_draft_source_run ON hot_topics_draft(source_run_id);

-- Create draft links table (maps draft topics to civic items/bills)
CREATE TABLE IF NOT EXISTS hot_topic_civic_items_draft (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  civic_item_id TEXT NOT NULL,
  
  -- Metadata
  confidence REAL DEFAULT 0.0, -- AI confidence for this specific link
  ai_source TEXT DEFAULT 'openai',
  trigger_snippet TEXT, -- Quote from bill explaining the link
  reason_summary TEXT, -- Explanation of why bill matches topic
  
  -- Ordering (for UI display)
  sort_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  FOREIGN KEY (topic_id) REFERENCES hot_topics_draft(id) ON DELETE CASCADE,
  FOREIGN KEY (civic_item_id) REFERENCES civic_items(id) ON DELETE CASCADE,
  UNIQUE(topic_id, civic_item_id)
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_draft_link_topic ON hot_topic_civic_items_draft(topic_id);
CREATE INDEX IF NOT EXISTS idx_draft_link_civic ON hot_topic_civic_items_draft(civic_item_id);
CREATE INDEX IF NOT EXISTS idx_draft_link_sort ON hot_topic_civic_items_draft(topic_id, sort_order);

-- Note: When publishing (approved → live), data is copied from:
--   hot_topics_draft → hot_topics (or UPDATE status in live tables)
--   hot_topic_civic_items_draft → hot_topic_civic_items
-- The draft records are kept for audit trail
