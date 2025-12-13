-- Migration: 0017_align_preferences_to_hot_topics.sql
-- Purpose: Consolidate preferences to use hot_topics as the canonical source
-- 
-- Problem: user_topic_prefs currently references topic_index (old table).
--          hot_topics page uses EVENTS_DB.hot_topics (new canonical table).
--          This causes misalignment between preferences and hot topics pages.
--
-- Solution: Recreate user_topic_prefs to reference hot_topics.id instead of topic_index.id
--           Update /api/user-topics to query hot_topics instead of topic_index.

-- Step 1: Temporarily disable foreign key constraints
PRAGMA foreign_keys = OFF;

-- Step 2: Rename old preferences table to preserve data
ALTER TABLE user_topic_prefs RENAME TO user_topic_prefs_old;

-- Step 3: Create new user_topic_prefs referencing hot_topics
CREATE TABLE user_topic_prefs (
  user_id TEXT NOT NULL,
  topic_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, topic_id),
  FOREIGN KEY (topic_id) REFERENCES hot_topics(id)
);

-- Step 4: Migrate data from old table (best-effort mapping via slug)
-- This matches old topic_index entries to hot_topics entries by slug
INSERT OR IGNORE INTO user_topic_prefs (user_id, topic_id, created_at, updated_at)
SELECT 
  utpo.user_id,
  ht.id,
  COALESCE(utpo.updated_at, CURRENT_TIMESTAMP),
  COALESCE(utpo.updated_at, CURRENT_TIMESTAMP)
FROM user_topic_prefs_old utpo
JOIN topic_index ti ON ti.id = utpo.topic_id
JOIN hot_topics ht ON ti.slug = ht.slug;

-- Step 5: Drop old table
DROP TABLE user_topic_prefs_old;

-- Step 6: Re-enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Step 7: Create triggers to maintain timestamps
CREATE TRIGGER IF NOT EXISTS trg_user_topic_prefs_insert
AFTER INSERT ON user_topic_prefs
BEGIN
  UPDATE user_topic_prefs
     SET created_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
   WHERE user_id = NEW.user_id AND topic_id = NEW.topic_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_user_topic_prefs_update
AFTER UPDATE ON user_topic_prefs
BEGIN
  UPDATE user_topic_prefs
     SET updated_at = CURRENT_TIMESTAMP
   WHERE user_id = NEW.user_id AND topic_id = NEW.topic_id;
END;
