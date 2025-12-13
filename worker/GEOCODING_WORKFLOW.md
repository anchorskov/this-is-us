VOTERS_ADDR_NORM GEOCODING WORKFLOW GUIDE
========================================

Date: December 9, 2025
Project: this-is-us.org
Database: WY_DB (wy)
Table: voters_addr_norm (274,656 rows)

════════════════════════════════════════════════════════════════════════════════
 1. SCHEMA AFTER MIGRATION 0014
════════════════════════════════════════════════════════════════════════════════

Table: voters_addr_norm

  voter_id (TEXT PRIMARY KEY)         -- Unique voter identifier
  addr1 (TEXT)                        -- Street address
  city (TEXT NOT NULL)                -- City name
  state (TEXT)                        -- State (typically "WY")
  zip (TEXT)                          -- ZIP code
  senate (TEXT)                       -- Senate district identifier
  house (TEXT)                        -- House district identifier
  fn (TEXT)                           -- First name
  ln (TEXT)                           -- Last name
  city_county_id (INTEGER)            -- Foreign key to wy_city_county.id
  street_index_id (INTEGER)           -- Foreign key to streets_index.id
  lat (REAL) NEW                      -- Latitude (from Census geocoding)
  lng (REAL) NEW                      -- Longitude (from Census geocoding)

Indexes:
  PRIMARY KEY on voter_id
  idx_voters_addr_norm_city ON (city)
  idx_voters_addr_norm_lat_lng ON (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL
  idx_voters_addr_norm_geocoded ON (voter_id) WHERE lat IS NOT NULL AND lng IS NOT NULL

Total columns after migration: 13

════════════════════════════════════════════════════════════════════════════════
 2. EXPORT → GEOCODE → UPDATE WORKFLOW
════════════════════════════════════════════════════════════════════════════════

PHASE 1: EXPORT UNGEOCODED ROWS
────────────────────────────────

Input: All rows in voters_addr_norm where lat IS NULL OR lng IS NULL
Output: CSV file for Census batch geocoder

CSV Path: data/voters_addr_norm_to_geocode.csv
CSV Columns:
  voter_id        -- Voter identifier (for matching results back)
  addr1           -- Street address
  city            -- City
  state           -- State
  zip             -- ZIP code

Example rows:
  voter_id,addr1,city,state,zip
  WY00001,"123 Main St","Cheyenne","WY","82001"
  WY00002,"456 Oak Ave","Laramie","WY","82070"

PHASE 2: BATCH GEOCODE
───────────────────────

Process:
  1. Read data/voters_addr_norm_to_geocode.csv
  2. Split into chunks of up to 10,000 rows (Census batch API limit)
  3. For each chunk:
     - Call U.S. Census Batch Geocoder (free, no API key required)
     - Wait for results
     - Log any timeouts or errors
  4. Merge all chunks into single output file

Geocoding Service Options:
  - U.S. Census Batch Geocoder (primary): https://geocoding.geo.census.gov/geocoder/
  - Nominatim (OpenStreetMap): https://nominatim.org/ (rate-limited)
  - Local geocoding with PostGIS (advanced)

PHASE 3: INGEST GEOCODED RESULTS
──────────────────────────────────

Input: CSV file from geocoding service
Output: Updates to voters_addr_norm.lat and voters_addr_norm.lng

CSV Path: data/voters_addr_norm_geocoded.csv
CSV Columns:
  voter_id        -- Voter identifier (link back to voters_addr_norm)
  lat             -- Latitude (decimal degrees)
  lng             -- Longitude (decimal degrees)
  status          -- Geocoding status

Status values:
  OK                 -- Valid match found, coordinates populated
  NO_MATCH           -- Address could not be geocoded
  MULTIPLE_MATCHES   -- Multiple matches found (may need manual review)
  INVALID_ADDRESS    -- Input address was malformed or incomplete
  ERROR              -- Geocoding service error

Example rows:
  voter_id,lat,lng,status
  WY00001,41.1400,-104.8202,OK
  WY00002,41.1400,-105.5911,OK
  WY00003,,NO_MATCH
  WY00004,41.1400,-105.5911,MULTIPLE_MATCHES

════════════════════════════════════════════════════════════════════════════════
 3. WSL COMMANDS FOR INSPECTION & EXPORT
════════════════════════════════════════════════════════════════════════════════

PREREQUISITE: Be in the worker directory

  cd /home/anchor/projects/this-is-us/worker

COMMAND 1: Verify migration applied (check schema)

  npx wrangler d1 execute WY_DB --local --command ".schema voters_addr_norm"

Expected output shows 13 columns including lat and lng.

────────────────────────────────────────────────────────────────────────────────

COMMAND 2: Check row counts

  # Total rows in voters_addr_norm
  npx wrangler d1 execute WY_DB --local \
    --command "SELECT COUNT(*) as total_rows FROM voters_addr_norm;"

  # Rows that still need geocoding (lat/lng both NULL)
  npx wrangler d1 execute WY_DB --local \
    --command "SELECT COUNT(*) as rows_needing_geocode FROM voters_addr_norm WHERE lat IS NULL OR lng IS NULL;"

  # Rows that are already geocoded
  npx wrangler d1 execute WY_DB --local \
    --command "SELECT COUNT(*) as rows_geocoded FROM voters_addr_norm WHERE lat IS NOT NULL AND lng IS NOT NULL;"

────────────────────────────────────────────────────────────────────────────────

COMMAND 3: Export ungeocoded rows to JSON first

  # Export as JSON (wrangler native format)
  npx wrangler d1 execute WY_DB --local \
    --command "SELECT voter_id, addr1, city, state, zip FROM voters_addr_norm WHERE lat IS NULL OR lng IS NULL;" \
    --json > ../data/voters_addr_norm_to_geocode.json

────────────────────────────────────────────────────────────────────────────────

COMMAND 4: Convert JSON to CSV using jq

  # Using jq (JSON query language, likely already on WSL)
  jq -r '.[] | [.voter_id, .addr1, .city, .state, .zip] | @csv' \
    ../data/voters_addr_norm_to_geocode.json \
    > ../data/voters_addr_norm_to_geocode.csv

  # Verify CSV was created
  head -5 ../data/voters_addr_norm_to_geocode.csv

────────────────────────────────────────────────────────────────────────────────

COMMAND 5: Alternative—use Node.js to export directly to CSV

  # Create a Node.js helper script (if jq is unavailable)
  cat > ../scripts/export_for_geocoding.js << 'EOF'
const fs = require('fs');

// Read JSON from stdin or file
const input = process.argv[2] || '../data/voters_addr_norm_to_geocode.json';
const data = JSON.parse(fs.readFileSync(input, 'utf-8'));

const output = process.argv[3] || '../data/voters_addr_norm_to_geocode.csv';
const stream = fs.createWriteStream(output);

// Write CSV header
stream.write('voter_id,addr1,city,state,zip\n');

// Write rows, escaping quotes in address
data.forEach(row => {
  const escapedAddr = (row.addr1 || '').replace(/"/g, '""');
  stream.write(`${row.voter_id},"${escapedAddr}",${row.city},${row.state},${row.zip}\n`);
});

stream.end();
console.log(`✅ Exported ${data.length} rows to ${output}`);
EOF

  # Run it
  node ../scripts/export_for_geocoding.js ../data/voters_addr_norm_to_geocode.json ../data/voters_addr_norm_to_geocode.csv

────────────────────────────────────────────────────────────────────────────────

COMMAND 6: Sample inspection—view first 10 rows needing geocoding

  # Export just the first 10 for a quick sanity check
  npx wrangler d1 execute WY_DB --local \
    --command "SELECT voter_id, addr1, city, state, zip FROM voters_addr_norm WHERE lat IS NULL OR lng IS NULL LIMIT 10;" \
    --json | jq '.[] | {voter_id, addr1, city, state, zip}' | head -20

────────────────────────────────────────────────────────────────────────────────

COMMAND 7: After geocoding—import results back into D1

  # Assuming data/voters_addr_norm_geocoded.csv has been populated by the geocoding service
  
  # Create a temporary table to load CSV
  npx wrangler d1 execute WY_DB --local --command \
    "CREATE TEMPORARY TABLE voters_geocoded_temp (voter_id TEXT, lat REAL, lng REAL, status TEXT);"

  # Load CSV (depends on D1 support; if not native, use intermediate JSON)
  # Alternative: convert CSV to SQL INSERTs

  # Update voters_addr_norm from temp table
  npx wrangler d1 execute WY_DB --local --command \
    "UPDATE voters_addr_norm SET lat = vg.lat, lng = vg.lng FROM voters_geocoded_temp vg WHERE voters_addr_norm.voter_id = vg.voter_id AND vg.status = 'OK';"

  # Verify updates
  npx wrangler d1 execute WY_DB --local \
    --command "SELECT COUNT(*) as updated_rows FROM voters_addr_norm WHERE lat IS NOT NULL AND lng IS NOT NULL;"

════════════════════════════════════════════════════════════════════════════════
 4. RUNTIME CODE INTEGRATION
════════════════════════════════════════════════════════════════════════════════

HELPER FUNCTION: getVerifiedUserLocation()

Location: worker/src/lib/voterVerification.mjs

Purpose: Query a verified voter's complete location info from voters_addr_norm,
         including county (via wy_city_county join) and lat/lng coordinates.

```javascript
/**
 * Get complete location info for a verified voter
 * Includes county name and coordinates if available
 * 
 * @param {object} env - Cloudflare Worker environment (env.WY_DB)
 * @param {string} voterId - Voter ID to look up
 * @returns {object|null} Voter location object or null if not found
 */
export async function getVerifiedUserLocation(env, voterId) {
  const result = await env.WY_DB.prepare(`
    SELECT 
      v.voter_id,
      v.city,
      v.state,
      v.zip,
      v.senate,
      v.house,
      v.lat,
      v.lng,
      cc.county as county_name
    FROM voters_addr_norm v
    LEFT JOIN wy_city_county cc ON v.city_county_id = cc.id
    WHERE v.voter_id = ?
  `).bind(voterId).first();
  
  if (!result) return null;
  
  return {
    voterId: result.voter_id,
    homeLocation: {
      city: result.city,
      state: result.state || 'WY',
      zip: result.zip,
      county: result.county_name,
      coordinates: (result.lat && result.lng)
        ? { lat: result.lat, lng: result.lng }
        : null  // null if not yet geocoded
    },
    districts: {
      house: result.house,
      senate: result.senate
    }
  };
}
```

USAGE IN HANDLERS:

Example: In worker/src/routes/voters.js, after verifying a voter's identity:

```javascript
import { getVerifiedUserLocation } from '../lib/voterVerification.mjs';

// After successful voter verification:
const location = await getVerifiedUserLocation(env, verified_voter_id);

if (location && location.homeLocation.coordinates) {
  // Voter has been geocoded; UI can use lat/lng directly
  // No need to ask for device location
  console.log(`✅ Verified voter ${location.voterId} has coordinates:`, 
    location.homeLocation.coordinates);
} else {
  // Voter exists but lat/lng not yet populated
  // UI may offer optional device location for proximity features
  console.log(`⚠️ Verified voter ${location.voterId} awaiting geocoding`);
}
```

KEY BENEFIT:

Once a resident verifies against voters_addr_norm, the system knows their verified address
and can optionally store its coordinates (lat/lng). This allows the frontend to:

  ✅ Show their county badge (from county_name)
  ✅ Show their districts (from senate/house)
  ✅ Use coordinates for proximity-based features (nearest representative, local events, etc.)
  ✅ Avoid asking for device location unless explicitly requested by the user

════════════════════════════════════════════════════════════════════════════════
 5. SUMMARY: NEXT STEPS FOR JIMMY
════════════════════════════════════════════════════════════════════════════════

Phase 1: Apply the Migration
  □ Review worker/migrations_wy/0014_add_lat_lng_to_voters_addr_norm.sql
  □ Test locally: npx wrangler d1 migrations apply WY_DB --local
  □ Verify schema: npx wrangler d1 execute WY_DB --local --command ".schema voters_addr_norm"

Phase 2: Export Data for Geocoding
  □ Use COMMAND 2 to check row counts
  □ Use COMMAND 3 + COMMAND 4 to export ungeocoded rows to CSV
  □ Save to data/voters_addr_norm_to_geocode.csv

Phase 3: Geocode (external process)
  □ Submit data/voters_addr_norm_to_geocode.csv to Census Batch Geocoder
  □ Receive results in data/voters_addr_norm_geocoded.csv (with lat, lng, status columns)

Phase 4: Import Results
  □ Use COMMAND 7 logic to update voters_addr_norm with lat/lng values
  □ Verify update counts

Phase 5: Integration
  □ Add getVerifiedUserLocation() helper to worker/src/lib/voterVerification.mjs
  □ Update worker/src/routes/voters.js to use helper after voter verification
  □ Test that lat/lng are returned when available

════════════════════════════════════════════════════════════════════════════════
