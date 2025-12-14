-- worker/migrations/0021_create_podcast_uploads.sql
CREATE TABLE IF NOT EXISTS podcast_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_slug TEXT NOT NULL,
  episode_date TEXT NOT NULL,
  part_number INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guest_slug, episode_date, part_number),
  UNIQUE(r2_key),
  UNIQUE(sha256)
);
