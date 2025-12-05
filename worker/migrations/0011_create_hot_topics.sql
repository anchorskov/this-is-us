-- Migration: Create hot topic cards + bill attachment join table
-- Tables:
--   hot_topics             – Rich card metadata for public display
--   hot_topic_civic_items  – Optional link to civic_items (bills) for later use

-- Core hot topic cards
CREATE TABLE IF NOT EXISTS hot_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  badge TEXT,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  priority INTEGER DEFAULT 100,          -- lower = higher priority
  is_active INTEGER DEFAULT 1,           -- 1 active, 0 hidden
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to keep updated_at fresh on updates
CREATE TRIGGER IF NOT EXISTS trg_hot_topics_updated
AFTER UPDATE ON hot_topics
BEGIN
  UPDATE hot_topics
     SET updated_at = CURRENT_TIMESTAMP
   WHERE id = NEW.id;
END;

-- Join to attach civic_items (bills) when ready
CREATE TABLE IF NOT EXISTS hot_topic_civic_items (
  topic_id INTEGER NOT NULL REFERENCES hot_topics(id),
  civic_item_id INTEGER NOT NULL,
  PRIMARY KEY (topic_id, civic_item_id)
);

-- Seed initial topics (card-ready). Adjust or extend as needed.
INSERT OR IGNORE INTO hot_topics
  (slug, title, summary, badge, cta_label, cta_url, priority)
VALUES
  ('property-tax-relief', 'Property Tax Relief',
    'Rising assessments are squeezing homeowners; proposals cap increases and expand exemptions.',
    'Taxes', 'See current proposals', '/hot-topics/property-tax-relief', 10),
  ('water-rights', 'Water Rights & Drought Planning',
    'Allocation rules and storage/efficiency funding to balance ag, energy, and municipal needs.',
    'Water', 'View water bills', '/hot-topics/water-rights', 20),
  ('education-funding', 'Education Funding & Local Control',
    'Adjusting school funding and curriculum oversight; impacts class sizes and local boards.',
    'Education', 'Review education bills', '/hot-topics/education-funding', 30),
  ('energy-permitting', 'Energy Permitting & Grid Reliability',
    'Streamlining permits for transmission/generation with reclamation standards.',
    'Energy', 'Check energy bills', '/hot-topics/energy-permitting', 40),
  ('public-safety-fentanyl', 'Public Safety & Fentanyl Response',
    'Penalties, interdiction funding, and treatment resources targeting opioid trafficking.',
    'Safety', 'See safety bills', '/hot-topics/public-safety-fentanyl', 50),
  ('housing-land-use', 'Housing & Land Use',
    'Zoning reforms, infrastructure grants, and incentives for workforce housing near jobs.',
    'Housing', 'Explore housing bills', '/hot-topics/housing-land-use', 60);
