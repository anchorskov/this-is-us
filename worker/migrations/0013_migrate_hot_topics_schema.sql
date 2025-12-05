-- Migration: Migrate hot_topics table to new schema
-- Drops old table and recreates with correct field names and structure
-- The old data is discarded; topics will be re-seeded

DROP TABLE IF EXISTS hot_topics;

-- Create hot_topics with correct schema
CREATE TABLE hot_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  badge TEXT,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  priority INTEGER DEFAULT 100,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to keep updated_at fresh on updates
CREATE TRIGGER trg_hot_topics_updated
AFTER UPDATE ON hot_topics
BEGIN
  UPDATE hot_topics
     SET updated_at = CURRENT_TIMESTAMP
   WHERE id = NEW.id;
END;

-- Seed initial topics
INSERT INTO hot_topics
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
