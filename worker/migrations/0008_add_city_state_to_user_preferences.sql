-- Add city and state columns to user_preferences if they don't exist
ALTER TABLE user_preferences ADD COLUMN city TEXT;
ALTER TABLE user_preferences ADD COLUMN state TEXT;
