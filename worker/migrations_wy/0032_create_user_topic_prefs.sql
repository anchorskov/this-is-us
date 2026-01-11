-- Migration: 0032_create_user_topic_prefs.sql
-- Purpose: Store user topic preferences tied to hot_topics in WY_DB

CREATE TABLE IF NOT EXISTS user_topic_prefs (
  user_id TEXT NOT NULL,
  topic_id INTEGER NOT NULL REFERENCES hot_topics(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, topic_id)
);

CREATE TRIGGER IF NOT EXISTS trg_user_topic_prefs_updated
AFTER UPDATE ON user_topic_prefs
BEGIN
  UPDATE user_topic_prefs
     SET updated_at = CURRENT_TIMESTAMP
   WHERE user_id = NEW.user_id AND topic_id = NEW.topic_id;
END;
