-- Migration: 0035_create_user_preferences.sql
-- Purpose: store firebase user preferences in WY_DB

CREATE TABLE IF NOT EXISTS user_preferences (
  firebase_uid TEXT PRIMARY KEY,
  email TEXT,
  theme TEXT,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  city TEXT,
  state TEXT
);
