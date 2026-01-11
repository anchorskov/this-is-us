════════════════════════════════════════════════════════════════════════════════
VOTERS_ADDR_NORM LAT/LNG IMPLEMENTATION SUMMARY
Created: December 9, 2025
Project: this-is-us.org (WY_DB)
Status: Ready for deployment
════════════════════════════════════════════════════════════════════════════════

DELIVERABLES
════════════════════════════════════════════════════════════════════════════════

1. MIGRATION FILE
   Location: worker/migrations_wy/0014_add_lat_lng_to_voters_addr_norm.sql
   
   What it does:
     • Adds lat REAL column to voters_addr_norm
     • Adds lng REAL column to voters_addr_norm
     • Creates idx_voters_addr_norm_lat_lng for proximity queries
     • Creates idx_voters_addr_norm_geocoded for data completeness checks
   
   Expected schema after:
     13 columns total (previously 11)
     4 indexes total (previously 1)

2. DOCUMENTATION
   • GEOCODING_WORKFLOW.md — detailed 5-phase workflow with code samples
   • VOTERS_ADDR_NORM_CHECKLIST.txt — quick reference + commands
   • This summary file

════════════════════════════════════════════════════════════════════════════════
FINAL SCHEMA (POST-MIGRATION)
════════════════════════════════════════════════════════════════════════════════

Table: voters_addr_norm

Columns (13 total):
  voter_id        (TEXT PRIMARY KEY)          — unique voter identifier
  addr1           (TEXT)                      — street address
  city            (TEXT NOT NULL)             — city
  state           (TEXT)                      — state (typically "WY")
  zip             (TEXT)                      — zip code
  senate          (TEXT)                      — senate district ID
  house           (TEXT)                      — house district ID
  fn              (TEXT)                      — first name
  ln              (TEXT)                      — last name
  city_county_id  (INTEGER)                   — FK to wy_city_county.id
  street_index_id (INTEGER)                   — FK to streets_index.id
  lat             (REAL) ★ NEW                — latitude from geocoding
  lng             (REAL) ★ NEW                — longitude from geocoding

Indexes (4 total):
  PRIMARY KEY on voter_id
  idx_voters_addr_norm_city (city)
  idx_voters_addr_norm_lat_lng (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL ★
  idx_voters_addr_norm_geocoded (voter_id) WHERE lat IS NOT NULL AND lng IS NOT NULL ★

Record count: 274,656 voters
Initial lat/lng state: NULL (to be populated by geocoding workflow)

════════════════════════════════════════════════════════════════════════════════
EXPORT → GEOCODE → UPDATE WORKFLOW
════════════════════════════════════════════════════════════════════════════════

PHASE 1: APPLY MIGRATION (Local D1)
───────────────────────────────────
Command:
  cd /home/anchor/projects/this-is-us/worker
  ./scripts/wr d1 migrations apply WY_DB --local

Verify:
  ./scripts/wr d1 execute WY_DB --local --command ".schema voters_addr_norm"
  (Should show lat and lng columns)

PHASE 2: EXPORT UNGEOCODED ROWS
────────────────────────────────
Step 2a: Export to JSON
  ./scripts/wr d1 execute WY_DB --local \
    --command "SELECT voter_id, addr1, city, state, zip FROM voters_addr_norm WHERE lat IS NULL OR lng IS NULL;" \
    --json > ../data/voters_addr_norm_to_geocode.json

Step 2b: Convert JSON to CSV
  jq -r '.[] | [.voter_id, .addr1, .city, .state, .zip] | @csv' \
    ../data/voters_addr_norm_to_geocode.json \
    > ../data/voters_addr_norm_to_geocode.csv

Verify:
  head ../data/voters_addr_norm_to_geocode.csv
  wc -l ../data/voters_addr_norm_to_geocode.csv
  (Should be ~274,657 including header)

PHASE 3: GEOCODE (External Service)
──────────────────────────────────────
Service: U.S. Census Batch Geocoder
  URL: https://geocoding.geo.census.gov/geocoder/
  
Input:  data/voters_addr_norm_to_geocode.csv
Output: data/voters_addr_norm_geocoded.csv

Process:
  1. Split CSV into chunks of ≤10,000 rows (Census batch limit)
  2. Submit each chunk to Census Batch Geocoder
  3. Merge results into single CSV with columns:
     voter_id, lat, lng, status
  4. Status values: OK, NO_MATCH, MULTIPLE_MATCHES, INVALID_ADDRESS, ERROR

Example output row:
  WY00001,41.1400,-104.8202,OK
  WY00003,,NO_MATCH

PHASE 4: IMPORT RESULTS INTO D1
────────────────────────────────
Objective: UPDATE voters_addr_norm.lat and voters_addr_norm.lng from geocoded CSV

Option A: Using Node.js helper (recommended if CSV ≤ 1 million rows)
  Create: scripts/import_geocoding_results.js
  Read CSV and generate UPDATE statements
  Execute UPDATE for each voter_id where status='OK'

Option B: Using D1 temp table (if D1 supports CSV import)
  CREATE TEMPORARY TABLE voters_geocoded_temp (voter_id TEXT, lat REAL, lng REAL, status TEXT);
  [Load CSV into temp table]
  UPDATE voters_addr_norm SET lat, lng FROM voters_geocoded_temp WHERE voter_id matches AND status='OK';

Verify:
  ./scripts/wr d1 execute WY_DB --local \
    --command "SELECT COUNT(*) as geocoded_count FROM voters_addr_norm WHERE lat IS NOT NULL AND lng IS NOT NULL;"
  (Should see row count increase)

PHASE 5: RUNTIME INTEGRATION
──────────────────────────────
Add helper function to: worker/src/lib/voterVerification.mjs

```javascript
export async function getVerifiedUserLocation(env, voterId) {
  const result = await env.WY_DB.prepare(`
    SELECT 
      v.voter_id, v.city, v.state, v.zip, v.senate, v.house, v.lat, v.lng,
      cc.county as county_name
    FROM voters_addr_norm v
    LEFT JOIN wy_city_county cc ON v.city_county_id = cc.id
    WHERE v.voter_id = ?
  `).bind(voterId).first();
  
  if (!result) return null;
  
  return {
    voterId: result.voter_id,
    homeLocation: {
      city: result.city, state: result.state || 'WY', zip: result.zip,
      county: result.county_name,
      coordinates: (result.lat && result.lng) ? { lat: result.lat, lng: result.lng } : null
    },
    districts: { house: result.house, senate: result.senate }
  };
}
```

Update handler in: worker/src/routes/voters.js

```javascript
// After successful voter verification:
const location = await getVerifiedUserLocation(env, voterId);

if (location?.homeLocation?.coordinates) {
  // Use verified coordinates for proximity features
  // Skip device location request
  console.log(`✅ Verified voter has coordinates:`, location.homeLocation.coordinates);
} else if (location) {
  // Voter verified but not yet geocoded
  console.log(`⚠️ Voter awaiting geocoding`);
}
```

════════════════════════════════════════════════════════════════════════════════
CSV SCHEMAS
════════════════════════════════════════════════════════════════════════════════

INPUT CSV: data/voters_addr_norm_to_geocode.csv
────────────────────────────────────────────────

Columns:
  voter_id    — unique voter identifier
  addr1       — street address (quoted to preserve commas/quotes)
  city        — city name
  state       — state code (WY)
  zip         — 5-digit zip code

Example:
  voter_id,addr1,city,state,zip
  WY00001,"123 Main St","Cheyenne","WY","82001"
  WY00002,"456 Oak Ave","Laramie","WY","82070"
  WY00003,"P.O. Box 100","Casper","WY","82602"

Row count: ~274,656 (plus header = ~274,657 lines)

OUTPUT CSV: data/voters_addr_norm_geocoded.csv
───────────────────────────────────────────────

Columns:
  voter_id    — matches input voter_id
  lat         — latitude (decimal degrees) or empty if not found
  lng         — longitude (decimal degrees) or empty if not found
  status      — geocoding result code

Status values:
  OK                  — Address geocoded successfully
  NO_MATCH            — Address could not be matched
  MULTIPLE_MATCHES    — Multiple matches found (needs manual review)
  INVALID_ADDRESS     — Input address was malformed
  ERROR               — Service error

Example:
  voter_id,lat,lng,status
  WY00001,41.1400,-104.8202,OK
  WY00002,41.1400,-105.5911,OK
  WY00003,,NO_MATCH
  WY00004,41.1400,-105.5911,MULTIPLE_MATCHES

Row count: Same as input (~274,656 data rows + 1 header)

════════════════════════════════════════════════════════════════════════════════
QUICK COMMANDS REFERENCE
════════════════════════════════════════════════════════════════════════════════

All commands assume: cd /home/anchor/projects/this-is-us/worker

--- Apply migration ---
./scripts/wr d1 migrations apply WY_DB --local

--- Check schema ---
./scripts/wr d1 execute WY_DB --local --command ".schema voters_addr_norm"

--- Count rows needing geocoding ---
./scripts/wr d1 execute WY_DB --local --command "SELECT COUNT(*) FROM voters_addr_norm WHERE lat IS NULL OR lng IS NULL;"

--- Count rows already geocoded ---
./scripts/wr d1 execute WY_DB --local --command "SELECT COUNT(*) FROM voters_addr_norm WHERE lat IS NOT NULL AND lng IS NOT NULL;"

--- Export to JSON ---
./scripts/wr d1 execute WY_DB --local --command "SELECT voter_id, addr1, city, state, zip FROM voters_addr_norm WHERE lat IS NULL OR lng IS NULL;" --json > ../data/voters_addr_norm_to_geocode.json

--- Convert JSON to CSV (requires jq) ---
jq -r '.[] | [.voter_id, .addr1, .city, .state, .zip] | @csv' ../data/voters_addr_norm_to_geocode.json > ../data/voters_addr_norm_to_geocode.csv

--- View sample rows for QA ---
./scripts/wr d1 execute WY_DB --local --command "SELECT voter_id, addr1, city FROM voters_addr_norm WHERE lat IS NULL LIMIT 5;" --json | jq '.'

════════════════════════════════════════════════════════════════════════════════
IMPLEMENTATION ROADMAP
════════════════════════════════════════════════════════════════════════════════

Week 1:
  ☐ Review worker/migrations_wy/0014_add_lat_lng_to_voters_addr_norm.sql
  ☐ Apply migration to local WY_DB
  ☐ Verify schema changes
  ☐ Export ungeocoded rows to data/voters_addr_norm_to_geocode.csv

Week 2:
  ☐ Prepare export for Census Batch Geocoder (handle 10k row chunks)
  ☐ Submit first batch to Census service
  ☐ Receive and validate results

Week 3:
  ☐ Complete geocoding of all batches
  ☐ Merge results into data/voters_addr_norm_geocoded.csv
  ☐ Develop import script (Node.js or SQL)
  ☐ Import results into D1 (UPDATE voters_addr_norm)
  ☐ Verify data completeness

Week 4:
  ☐ Add getVerifiedUserLocation() helper to worker/src/lib/voterVerification.mjs
  ☐ Update worker/src/routes/voters.js to use helper
  ☐ Test voter lookup API with coordinates
  ☐ Deploy to production with migration

════════════════════════════════════════════════════════════════════════════════
BENEFITS OF ADDING LAT/LNG
════════════════════════════════════════════════════════════════════════════════

✅ Verified voter location is cached in D1 (fast lookups)
✅ Frontend can show verified location without device permission
✅ Eliminates repeated geolocation prompts for same voter
✅ Enables proximity-based features (nearest representative, local events)
✅ Improves performance for map-based UI
✅ Provides fallback if device geolocation is denied or unavailable
✅ Complies with privacy-first design (uses verified address, not device location)
✅ Lazy initialization: coordinates populated gradually during geocoding phase

════════════════════════════════════════════════════════════════════════════════
NOTES FOR JIMMY
════════════════════════════════════════════════════════════════════════════════

• Migration file is ready to deploy: worker/migrations_wy/0014_add_lat_lng_to_voters_addr_norm.sql

• Two detailed guides are available:
  - GEOCODING_WORKFLOW.md (5 phases with code samples)
  - VOTERS_ADDR_NORM_CHECKLIST.txt (quick reference + troubleshooting)

• Census Batch Geocoder is free and requires no API key:
  https://geocoding.geo.census.gov/geocoder/

• The 10,000-row batch limit means ~28 API calls for 274k voters

• All CSV schemas are defined; export/import process is self-contained

• Once geocoding is complete, add the getVerifiedUserLocation() helper
  to enable runtime access to coordinates

════════════════════════════════════════════════════════════════════════════════
