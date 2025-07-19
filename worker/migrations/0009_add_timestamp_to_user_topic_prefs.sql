/* 0009_add_timestamp_to_user_topic_prefs.sql
   Adds an updated_at column + triggers so every toggle
   automatically records when the user last changed a topic.
*/

/* 1️⃣  Add column (runs once, safe in prod). */
ALTER TABLE user_topic_prefs
  ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

/* 2️⃣  Stamp inserts (row first created). */
CREATE TRIGGER IF NOT EXISTS trg_user_topic_insert
AFTER INSERT ON user_topic_prefs
BEGIN
  UPDATE user_topic_prefs
     SET updated_at = CURRENT_TIMESTAMP
   WHERE user_id  = NEW.user_id
     AND topic_id = NEW.topic_id;
END;

/* 3️⃣  Stamp updates (future-proof for any UPDATEs). */
CREATE TRIGGER IF NOT EXISTS trg_user_topic_update
AFTER UPDATE ON user_topic_prefs
BEGIN
  UPDATE user_topic_prefs
     SET updated_at = CURRENT_TIMESTAMP
   WHERE user_id  = NEW.user_id
     AND topic_id = NEW.topic_id;
END;
