 CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sponsor TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  lat REAL,
  lng REAL,
  pdf_hash TEXT,
  description TEXT,
  pdf_key TEXT
);

CREATE INDEX idx_events_pdf_hash ON events(pdf_hash);

CREATE TABLE candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  office TEXT NOT NULL,
  location TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  pdf_key TEXT NOT NULL
);

CREATE TABLE townhall_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT,
  created_at TEXT NOT NULL,
  r2_key TEXT,
  file_size INTEGER,
  expires_at TEXT,
  city TEXT DEFAULT '',
  state TEXT DEFAULT ''
);
