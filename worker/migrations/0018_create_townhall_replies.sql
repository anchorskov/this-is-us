-- Migration number: 0018 	 2025-12-10T14:00:00.000Z
-- Purpose: Create townhall_replies table for Town Hall thread conversations
-- Enables nested discussions within Town Hall threads posted by verified voters

CREATE TABLE IF NOT EXISTS townhall_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  author_voter_id TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  parent_reply_id INTEGER,

  FOREIGN KEY (thread_id) REFERENCES townhall_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_reply_id) REFERENCES townhall_replies(id) ON DELETE CASCADE
);

-- Index for efficient thread reply listing with status filtering
CREATE INDEX IF NOT EXISTS idx_townhall_replies_thread_status
  ON townhall_replies(thread_id, status)
  WHERE status = 'active';

-- Index for author history (view all replies by a user)
CREATE INDEX IF NOT EXISTS idx_townhall_replies_author_user_id
  ON townhall_replies(author_user_id);

-- Index for nested reply chains (find parent-child relationships)
CREATE INDEX IF NOT EXISTS idx_townhall_replies_parent
  ON townhall_replies(parent_reply_id)
  WHERE parent_reply_id IS NOT NULL;

-- Index for chronological sorting (most recent first)
CREATE INDEX IF NOT EXISTS idx_townhall_replies_created_at
  ON townhall_replies(created_at DESC);
