-- Migration: 0014_add_lat_lng_to_voters_addr_norm
-- Purpose: Add latitude and longitude columns to voters_addr_norm table
--          to support geocoding-based lookups and eliminate repeated device location requests
-- Date: December 9, 2025
-- Status: Add coordinates as NULL; will be populated via Census geocoding workflow

-- Add latitude and longitude columns
ALTER TABLE voters_addr_norm ADD COLUMN lat REAL;
ALTER TABLE voters_addr_norm ADD COLUMN lng REAL;

-- Index on lat/lng for proximity queries and fast lookups of geocoded rows
-- Uses partial index (WHERE lat IS NOT NULL AND lng IS NOT NULL) to keep index lean
CREATE INDEX IF NOT EXISTS idx_voters_addr_norm_lat_lng
ON voters_addr_norm(lat, lng)
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Optional: Index to quickly check which voters have been geocoded
-- Useful for ETL and data completeness checks
CREATE INDEX IF NOT EXISTS idx_voters_addr_norm_geocoded
ON voters_addr_norm(voter_id)
WHERE lat IS NOT NULL AND lng IS NOT NULL;
