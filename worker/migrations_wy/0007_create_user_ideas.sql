-- worker/migrations_wy/0007_create_user_ideas.sql
-- Create user_ideas table for user-submitted ideas tied to civic items

CREATE TABLE user_ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT REFERENCES civic_items(id),
  author_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  up_votes INTEGER NOT NULL DEFAULT 0,
  down_votes INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_user_ideas_item ON user_ideas(item_id);
CREATE INDEX idx_user_ideas_author ON user_ideas(author_user_id);
