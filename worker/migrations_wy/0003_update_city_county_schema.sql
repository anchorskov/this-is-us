-- Migration 026: Update wy_city_county schema to match remote
-- Remote uses: id INTEGER PRIMARY KEY, city_norm, county_norm
-- Add normalized column versions for consistency with remote schema

-- Note: These columns likely already exist on production.
-- This migration is primarily for new development environments.
-- If you see "duplicate column name" errors, it means this migration
-- has already been successfully applied to your database.

ALTER TABLE wy_city_county ADD COLUMN city_norm TEXT;
ALTER TABLE wy_city_county ADD COLUMN county_norm TEXT;
ALTER TABLE wy_city_county ADD COLUMN city_raw TEXT;
ALTER TABLE wy_city_county ADD COLUMN county_raw TEXT;
