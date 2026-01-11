-- Create topic object tables in WY_DB
CREATE TABLE IF NOT EXISTS topics (
  topic_key TEXT PRIMARY KEY,
  label_short TEXT NOT NULL,
  label_full TEXT,
  one_sentence TEXT,
  synonyms_json TEXT,
  parent_key TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bill_topics (
  bill_id TEXT NOT NULL,
  topic_key TEXT NOT NULL,
  confidence REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (bill_id, topic_key),
  FOREIGN KEY (topic_key) REFERENCES topics(topic_key)
);

CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status);
CREATE INDEX IF NOT EXISTS idx_bill_topics_topic ON bill_topics(topic_key);
CREATE INDEX IF NOT EXISTS idx_bill_topics_created_at ON bill_topics(created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_topics_updated_at
AFTER UPDATE ON topics
BEGIN
  UPDATE topics SET updated_at = CURRENT_TIMESTAMP WHERE topic_key = NEW.topic_key;
END;
