CREATE TABLE IF NOT EXISTS user_preferences (
  firebase_uid TEXT PRIMARY KEY,
  email TEXT,
  theme TEXT,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
