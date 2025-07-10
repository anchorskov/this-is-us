-- Create table of available topics
CREATE TABLE IF NOT EXISTS topic_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

-- Create user-topic preference join table
CREATE TABLE IF NOT EXISTS user_topic_prefs (
  user_id TEXT NOT NULL,
  topic_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, topic_id),
  FOREIGN KEY (topic_id) REFERENCES topic_index(id)
);

-- Create topic request moderation queue
CREATE TABLE IF NOT EXISTS topic_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  proposed_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
