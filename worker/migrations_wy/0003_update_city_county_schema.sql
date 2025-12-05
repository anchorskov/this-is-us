-- Migration 026: Update wy_city_county schema to match remote
-- Remote uses: id INTEGER PRIMARY KEY, city_norm, county_norm
-- Add normalized column versions for consistency with remote schema

-- Add missing columns to wy_city_county (if they don't exist)
ALTER TABLE wy_city_county ADD COLUMN city_norm TEXT;
ALTER TABLE wy_city_county ADD COLUMN county_norm TEXT;
ALTER TABLE wy_city_county ADD COLUMN city_raw TEXT;
ALTER TABLE wy_city_county ADD COLUMN county_raw TEXT;
