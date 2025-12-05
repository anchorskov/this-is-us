-- Create voters_addr_norm table for local testing
-- This mirrors the remote schema from WY_DB

CREATE TABLE IF NOT EXISTS voters_addr_norm (
  voter_id TEXT PRIMARY KEY,
  ln TEXT,
  fn TEXT,
  addr1 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  senate TEXT,
  house TEXT,
  city_county_id INTEGER,
  street_index_id INTEGER,
  addr_raw TEXT
);

-- Create wy_city_county lookup table for county filtering
CREATE TABLE IF NOT EXISTS wy_city_county (
  id INTEGER PRIMARY KEY,
  city_raw TEXT NOT NULL,
  county_raw TEXT NOT NULL,
  city_norm TEXT NOT NULL,
  county_norm TEXT NOT NULL
);

-- Insert city-county mappings needed for test fixtures
INSERT OR IGNORE INTO wy_city_county (id, city_raw, county_raw, city_norm, county_norm)
VALUES
  (1, 'LARAMIE', 'ALBANY', 'LARAMIE', 'ALBANY'),
  (25, 'GILLETTE', 'CAMPBELL', 'GILLETTE', 'CAMPBELL'),
  (104, 'CHEYENNE', 'LARAMIE', 'CHEYENNE', 'LARAMIE'),
  (129, 'CASPER', 'NATRONA', 'CASPER', 'NATRONA'),
  (168, 'ROCK SPRINGS', 'SWEETWATER', 'ROCK SPRINGS', 'SWEETWATER');

-- Insert test fixtures for voter lookup testing
INSERT INTO voters_addr_norm (voter_id, ln, fn, addr1, city, state, zip, senate, house, city_county_id, addr_raw)
VALUES 
  ('WY-001', 'SMITH', 'JOHN', '123 MAIN ST', 'CHEYENNE', 'WY', '82001', 'SD-01', 'HD-01', 104, '123 MAIN ST CHEYENNE WY 82001'),
  ('WY-002', 'SMITH', 'JANE', '456 ELK AVE', 'CASPER', 'WY', '82601', 'SD-02', 'HD-02', 129, '456 ELK AVE CASPER WY 82601'),
  ('WY-003', 'JOHNSON', 'ROBERT', '789 LODGE RD', 'LARAMIE', 'WY', '82070', 'SD-01', 'HD-03', 1, '789 LODGE RD LARAMIE WY 82070'),
  ('WY-004', 'JOHNSON', 'MARY', '321 PARK LN', 'GILLETTE', 'WY', '82716', 'SD-03', 'HD-04', 25, '321 PARK LN GILLETTE WY 82716'),
  ('WY-005', 'WILLIAMS', 'DAVID', '654 RIDGE WAY', 'ROCK SPRINGS', 'WY', '82901', 'SD-02', 'HD-05', 168, '654 RIDGE WAY ROCK SPRINGS WY 82901');
