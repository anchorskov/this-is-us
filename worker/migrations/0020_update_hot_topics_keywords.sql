-- Migration: 0020 - Update hot_topics with AI-friendly keywords and add 6 new topics
-- Purpose: Convert hot_topics summaries to comma-separated keywords for AI tagging
--          and add 6 new topics for expanded coverage
-- Date: December 11, 2025
-- Database: EVENTS_DB (Cloudflare D1)

-- ════════════════════════════════════════════════════════════════════════════════
-- PHASE A: UPDATE existing 6 topics with keyword-style summaries
-- ════════════════════════════════════════════════════════════════════════════════

UPDATE hot_topics SET summary = 'property tax, mill levies, rising assessments, homeowner relief, exemptions, caps, senior tax relief' WHERE slug = 'property-tax-relief';

UPDATE hot_topics SET summary = 'water rights, irrigation, drought, reservoirs, storage, agricultural water, municipal water, river compacts, groundwater' WHERE slug = 'water-rights';

UPDATE hot_topics SET summary = 'school funding, K-12 budgets, education spending, block grant, class sizes, teacher pay, curriculum oversight, local school boards' WHERE slug = 'education-funding';

UPDATE hot_topics SET summary = 'energy projects, transmission lines, wind, solar, oil and gas, permits, siting, reclamation, bonding, environmental review' WHERE slug = 'energy-permitting';

UPDATE hot_topics SET summary = 'public safety, crime, theft, burglary, fentanyl, opioids, drug trafficking, sentencing, penalties, law enforcement' WHERE slug = 'public-safety-fentanyl';

UPDATE hot_topics SET summary = 'housing costs, zoning, subdivision, land use, workforce housing, infill, infrastructure for housing, building codes, rental supply' WHERE slug = 'housing-land-use';

-- ════════════════════════════════════════════════════════════════════════════════
-- PHASE B: INSERT 6 new topics
-- ════════════════════════════════════════════════════════════════════════════════

INSERT INTO hot_topics (slug, title, badge, summary, priority, is_active, match_criteria_json) 
VALUES (
  'reproductive-health',
  'Reproductive Health',
  'Health',
  'pregnancy centers, reproductive health, prenatal care, counseling, abortion, crisis pregnancy, maternal services, patient rights',
  100,
  1,
  NULL
);

INSERT INTO hot_topics (slug, title, badge, summary, priority, is_active, match_criteria_json) 
VALUES (
  'rural-healthcare-hospitals',
  'Rural Healthcare & Hospitals',
  'Health',
  'rural hospitals, clinic closures, hospital bankruptcy, emergency rooms, maternity care, critical access hospitals, medical staffing, ambulance service',
  100,
  1,
  NULL
);

INSERT INTO hot_topics (slug, title, badge, summary, priority, is_active, match_criteria_json) 
VALUES (
  'property-rights-eminent-domain',
  'Property Rights & Eminent Domain',
  'Property',
  'eminent domain, landowner rights, condemnation, easements, rights of way, compensation, pipelines, transmission corridors, takings',
  100,
  1,
  NULL
);

INSERT INTO hot_topics (slug, title, badge, summary, priority, is_active, match_criteria_json) 
VALUES (
  'state-lands-grazing',
  'State Lands & Grazing',
  'Lands',
  'state trust lands, grazing leases, sublease rules, ranching, range management, lease rates, public access, cattle, sheep',
  100,
  1,
  NULL
);

INSERT INTO hot_topics (slug, title, badge, summary, priority, is_active, match_criteria_json) 
VALUES (
  'clean-air-geoengineering',
  'Clean Air & Geoengineering',
  'Environment',
  'clean air, air quality, emissions, geoengineering, cloud seeding, atmospheric modification, pollution, health impacts, sky experiments',
  100,
  1,
  NULL
);

INSERT INTO hot_topics (slug, title, badge, summary, priority, is_active, match_criteria_json) 
VALUES (
  'guard-veterans-support',
  'Guard & Veterans Support',
  'Service',
  'national guard, reenlistment, bonuses, veteran benefits, military families, deployments, mental health for veterans, education benefits, retention',
  100,
  1,
  NULL
);

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ════════════════════════════════════════════════════════════════════════════════
-- Apply with:
--   cd /home/anchor/projects/this-is-us/worker
--   ./scripts/wr d1 migrations apply EVENTS_DB --local
--
-- Verify with:
--   ./scripts/wr d1 execute EVENTS_DB --local --command "SELECT id, slug, badge, title, summary FROM hot_topics ORDER BY id;"
-- ════════════════════════════════════════════════════════════════════════════════
