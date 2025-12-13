-- Migration: Create wy_legislators table
-- Stores Wyoming state legislators with contact info, indexed by chamber/district
-- Enables delegation lookup and bill sponsor matching
--
-- Schema matches existing legislature table structure:
-- - voter_id: Unique identifier from voter database
-- - name: Full legislator name
-- - chamber: "house" or "Senate"
-- - district: District number (integer)
-- - city: Legislator's city
-- - county: Legislator's county
-- - party: Political party (R/D/etc)
-- - affiliations: Any group affiliations
-- - campaign_website: Campaign site URL
-- - official_profile_url: Official state profile URL
-- - phone: Contact phone number
-- - email: Contact email address
-- - updated: Last updated timestamp

CREATE TABLE wy_legislators (
  voter_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  chamber TEXT NOT NULL,
  district INTEGER,
  city TEXT,
  county TEXT,
  party TEXT,
  affiliations TEXT,
  campaign_website TEXT,
  official_profile_url TEXT,
  phone TEXT,
  email TEXT,
  updated TEXT
);

CREATE INDEX idx_wy_legislators_chamber_district ON wy_legislators(chamber, district);
CREATE INDEX idx_wy_legislators_name ON wy_legislators(name);
