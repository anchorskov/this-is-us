-- AI tagging for civic_items (hot topic detection)
CREATE TABLE IF NOT EXISTS civic_item_ai_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,            -- references civic_items.id
  topic_slug TEXT NOT NULL,         -- matches EVENTS_DB.hot_topics.slug when possible
  confidence REAL NOT NULL,
  trigger_snippet TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS civic_item_ai_tags_item_topic
  ON civic_item_ai_tags (item_id, topic_slug);
