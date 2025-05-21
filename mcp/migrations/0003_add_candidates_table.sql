CREATE TABLE IF NOT EXISTS candidates (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT    NOT NULL,
  office    TEXT    NOT NULL,
  location  TEXT    NOT NULL,
  pdf_url   TEXT,
  pdf_key   TEXT
);
