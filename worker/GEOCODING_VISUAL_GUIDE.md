════════════════════════════════════════════════════════════════════════════════
VOTERS_ADDR_NORM GEOCODING WORKFLOW - VISUAL GUIDE
════════════════════════════════════════════════════════════════════════════════

OVERALL ARCHITECTURE
────────────────────────────────────────────────────────────────────────────────

    ┌─────────────────────────┐
    │   WY_DB (D1 Database)   │
    │   voters_addr_norm      │
    │   274,656 rows          │
    │   (before: 11 cols)     │
    │   (after:  13 cols)     │
    └────────────┬────────────┘
                 │
                 │ MIGRATION 0014:
                 │ ALTER TABLE ADD lat, lng
                 │ CREATE 2 indexes
                 │
                 ▼
    ┌─────────────────────────┐
    │   voters_addr_norm      │
    │   (post-migration)      │
    │   ✓ voter_id (PK)       │
    │   ✓ addr1, city, state  │
    │   ✓ zip, senate, house  │
    │   ✓ fn, ln              │
    │   ✓ city_county_id      │
    │   ✓ street_index_id     │
    │   ✓ lat (REAL) NEW      │
    │   ✓ lng (REAL) NEW      │
    └────────────┬────────────┘
                 │
    ═════════════╩═════════════════════════════════════════════════════════════
                 │
                 │  PHASE 1-2: EXPORT
                 ▼
    ┌────────────────────────────────────────┐
    │  voters_addr_norm_to_geocode.csv       │
    │  (export from D1, rows with lat=NULL)  │
    │                                        │
    │  Columns:                              │
    │    voter_id, addr1, city, state, zip  │
    │                                        │
    │  Rows: ~274,656 (all ungeocoded)       │
    │  Format: CSV, UTF-8                    │
    └─────────────────┬──────────────────────┘
                      │
                      │  SPLIT INTO 10K CHUNKS
                      │
    ══════════════════╩══════════════════════════════════════════════════════════
                      │
                      │  PHASE 3: EXTERNAL GEOCODING
                      ▼
    ┌──────────────────────────────────────────────────────────────────┐
    │   U.S. Census Batch Geocoder                                     │
    │   (https://geocoding.geo.census.gov/geocoder/)                   │
    │                                                                  │
    │   Process:                                                       │
    │   1. Upload CSV chunk (≤10,000 rows)                             │
    │   2. Service returns lat, lng, match_type                        │
    │   3. Repeat for all chunks (~28 total)                           │
    │                                                                  │
    │   Output: Geocoded results with accuracy metadata                │
    └─────────────────────┬────────────────────────────────────────────┘
                          │
                          │  MERGE ALL CHUNKS
                          ▼
    ┌────────────────────────────────────────┐
    │  voters_addr_norm_geocoded.csv         │
    │  (output from Census geocoder)         │
    │                                        │
    │  Columns:                              │
    │    voter_id, lat, lng, status          │
    │                                        │
    │  Rows: ~274,656                        │
    │  Status values:                        │
    │    OK                                  │
    │    NO_MATCH                            │
    │    MULTIPLE_MATCHES                    │
    │    INVALID_ADDRESS                     │
    │    ERROR                               │
    └─────────────────┬──────────────────────┘
                      │
    ══════════════════╩══════════════════════════════════════════════════════════
                      │
                      │  PHASE 4: IMPORT INTO D1
                      ▼
    ┌─────────────────────────────────────────────────────────┐
    │  Node.js Import Script                                  │
    │  (scripts/import_geocoding_results.js)                  │
    │                                                         │
    │  Logic:                                                 │
    │    FOR EACH row in voters_addr_norm_geocoded.csv:       │
    │      IF status = 'OK':                                  │
    │        UPDATE voters_addr_norm                          │
    │        SET lat = ?, lng = ?                             │
    │        WHERE voter_id = ?                               │
    │      ELSE:                                              │
    │        LOG as data quality issue                        │
    │                                                         │
    │  Performance: Batch updates in transactions             │
    │  Verify: SELECT COUNT(*) WHERE lat IS NOT NULL;        │
    └─────────────────┬──────────────────────────────────────┘
                      │
                      │  UPDATE voters_addr_norm
                      │  SET lat, lng
                      │  FROM geocoded results
                      │
                      ▼
    ┌─────────────────────────────────────────────────────────┐
    │  voters_addr_norm (FINAL STATE)                         │
    │                                                         │
    │  ✓ All 274,656 rows now have:                           │
    │    - voter_id (PK)                                      │
    │    - addr1, city, state, zip                            │
    │    - senate, house (district IDs)                       │
    │    - fn, ln (names)                                     │
    │    - city_county_id (FK)                                │
    │    - street_index_id (FK)                               │
    │    - lat, lng (from Census)                             │
    │                                                         │
    │  Data quality:                                          │
    │    ~240k-260k rows: lat/lng = valid coordinates (OK)   │
    │    ~10k-20k rows: lat/lng = NULL (NO_MATCH)             │
    │    Remaining: lat/lng = NULL (errors)                   │
    │                                                         │
    │  Indexes:                                               │
    │    ✓ PRIMARY KEY (voter_id)                             │
    │    ✓ idx_voters_addr_norm_city                          │
    │    ✓ idx_voters_addr_norm_lat_lng (WHERE NOT NULL)      │
    │    ✓ idx_voters_addr_norm_geocoded (WHERE NOT NULL)     │
    └──────────────────┬──────────────────────────────────────┘
                       │
    ═══════════════════╩════════════════════════════════════════════════════════
                       │
                       │  PHASE 5: RUNTIME INTEGRATION
                       ▼
    ┌────────────────────────────────────────────────────────────┐
    │  worker/src/lib/voterVerification.mjs                      │
    │                                                            │
    │  getVerifiedUserLocation(env, voterId):                    │
    │    SELECT                                                  │
    │      voter_id, city, state, zip,                           │
    │      senate, house, lat, lng,                              │
    │      county_name (from wy_city_county JOIN)                │
    │    FROM voters_addr_norm v                                 │
    │    WHERE voter_id = ?                                      │
    │                                                            │
    │  Returns:                                                  │
    │    {                                                       │
    │      voterId,                                              │
    │      homeLocation: {                                       │
    │        city, state, zip, county,                           │
    │        coordinates: { lat, lng } OR null                   │
    │      },                                                    │
    │      districts: { house, senate }                          │
    │    }                                                       │
    └────────────────┬─────────────────────────────────────────┘
                     │
                     │  Called after voter verification
                     │
                     ▼
    ┌────────────────────────────────────────────────────────────┐
    │  worker/src/routes/voters.js                               │
    │  handleVoterLookup()                                        │
    │                                                            │
    │  BEFORE (no lat/lng):                                       │
    │    Frontend must ask for device location permission         │
    │                                                            │
    │  AFTER (with lat/lng):                                      │
    │    if (location?.homeLocation?.coordinates) {              │
    │      // Use verified coordinates                           │
    │      // Skip device location request                       │
    │      // Enable proximity features                          │
    │    }                                                       │
    └────────────────┬─────────────────────────────────────────┘
                     │
                     │  API Response includes lat/lng
                     │  (if available)
                     │
                     ▼
    ┌────────────────────────────────────────────────────────────┐
    │  Frontend / Web Application                                │
    │                                                            │
    │  Features enabled by lat/lng:                              │
    │    ✓ County badge (verified location)                      │
    │    ✓ District identification                               │
    │    ✓ Proximity-based lookups (nearest rep)                 │
    │    ✓ Map view with verified marker                         │
    │    ✓ No device location prompt for verified voters         │
    │    ✓ Faster load times (no geolocation API)                │
    │    ✓ Better privacy (no device tracking)                   │
    └────────────────────────────────────────────────────────────┘

════════════════════════════════════════════════════════════════════════════════
CSV FLOW DETAIL
════════════════════════════════════════════════════════════════════════════════

STEP 1: Export from D1 (JSON → CSV)
───────────────────────────────────

   D1 Query Result (JSON)
   ┌─────────────────────────────────────────────────┐
   │ [                                               │
   │   { "voter_id": "WY00001",                      │
   │     "addr1": "123 Main St",                     │
   │     "city": "Cheyenne",                         │
   │     "state": "WY",                              │
   │     "zip": "82001" },                           │
   │   { "voter_id": "WY00002", ... },               │
   │   ...                                           │
   │ ]                                               │
   └──────────────────┬───────────────────────────────┘
                      │
                      │ jq conversion
                      │ (extracts and formats)
                      ▼
   CSV File (voters_addr_norm_to_geocode.csv)
   ┌─────────────────────────────────────────────────┐
   │ voter_id,addr1,city,state,zip                  │
   │ WY00001,"123 Main St","Cheyenne","WY","82001"  │
   │ WY00002,"456 Oak Ave","Laramie","WY","82070"   │
   │ WY00003,"789 Pine Rd","Casper","WY","82602"    │
   │ ... 274,653 more rows ...                       │
   └──────────────────┬───────────────────────────────┘
                      │
                      │ Upload to Census Batch Geocoder
                      │ (in 10K row chunks)
                      ▼

STEP 2: Geocode (Census Batch Geocoder)
────────────────────────────────────────

   Input Chunk 1 (rows 1-10,000)
   ┌─────────────────────────────────────────┐
   │ voter_id,addr1,city,state,zip           │
   │ WY00001,"123 Main St","Cheyenne",...    │
   │ ... 10,000 rows ...                     │
   └────────────────┬────────────────────────┘
                    │
                    │ Submit to Census API
                    ▼
   Output Chunk 1 (from Census)
   ┌──────────────────────────────────────────┐
   │ voter_id,lat,lng,status                  │
   │ WY00001,41.1400,-104.8202,OK             │
   │ WY00002,41.1400,-105.5911,OK             │
   │ ... 10,000 rows (mixed statuses) ...     │
   └────────────────┬───────────────────────┘
                    │
   [Repeat for chunks 2-28]
                    │
                    ▼

STEP 3: Merge Results
─────────────────────

   All Chunks Merged
   ┌──────────────────────────────────────────┐
   │ voter_id,lat,lng,status                  │
   │ WY00001,41.1400,-104.8202,OK             │
   │ WY00002,41.1400,-105.5911,OK             │
   │ WY00003,,NO_MATCH                        │
   │ WY00004,41.1400,-105.5911,MULTIPLE...   │
   │ ... 274,656 total rows ...               │
   │                                          │
   │ Status distribution (expected):          │
   │   OK: ~240k-260k rows                   │
   │   NO_MATCH: ~10k-20k rows                │
   │   Other: ~5k rows (errors)               │
   └────────────────┬───────────────────────┘
                    │
                    │ Save as voters_addr_norm_geocoded.csv
                    ▼

STEP 4: Import into D1
──────────────────────

   For each row in voters_addr_norm_geocoded.csv:
   
   IF status = 'OK':
      UPDATE voters_addr_norm
      SET lat = ?, lng = ?
      WHERE voter_id = ?
      
   Progress tracking:
      ✓ Row 1-1000: lat/lng updated
      ✓ Row 1001-2000: lat/lng updated
      ...
      ✓ Row 274601-274656: lat/lng updated
      
   Final state:
      SELECT COUNT(*) FROM voters_addr_norm WHERE lat IS NOT NULL;
      Result: ~240k-260k rows now geocoded

════════════════════════════════════════════════════════════════════════════════
DATA FLOW BY VOTER STATE
════════════════════════════════════════════════════════════════════════════════

UNVERIFIED USER
───────────────
   (No entry in voters_addr_norm yet)
   └─ Cannot use lat/lng
   └─ Must ask for device location if proximity features needed


VERIFIED USER (BEFORE GEOCODING)
─────────────────────────────────
   voters_addr_norm entry exists
   │
   ├─ voter_id ✓
   ├─ addr1, city, state, zip ✓
   ├─ senate, house ✓
   ├─ fn, ln ✓
   │
   ├─ lat = NULL ✗
   └─ lng = NULL ✗
   
   API response:
   {
     "voter_id": "WY00001",
     "homeLocation": {
       "city": "Cheyenne",
       "county": "Laramie",
       "coordinates": null  ← Not yet geocoded
     },
     "districts": {
       "house": "15",
       "senate": "02"
     }
   }


VERIFIED USER (AFTER GEOCODING)
────────────────────────────────
   voters_addr_norm entry updated
   │
   ├─ voter_id ✓
   ├─ addr1, city, state, zip ✓
   ├─ senate, house ✓
   ├─ fn, ln ✓
   │
   ├─ lat = 41.1400 ✓  ← Now geocoded!
   └─ lng = -104.8202 ✓
   
   API response:
   {
     "voter_id": "WY00001",
     "homeLocation": {
       "city": "Cheyenne",
       "county": "Laramie",
       "coordinates": {           ← Now available!
         "lat": 41.1400,
         "lng": -104.8202
       }
     },
     "districts": {
       "house": "15",
       "senate": "02"
     }
   }
   
   Frontend can now:
   ✓ Skip device location permission
   ✓ Use verified coordinates
   ✓ Show map with verified location
   ✓ Enable proximity features


NO_MATCH CASE (Address couldn't be geocoded)
──────────────────────────────────────────────
   voters_addr_norm entry exists
   │
   ├─ voter_id ✓
   ├─ addr1, city, state, zip ✓
   │
   ├─ lat = NULL  ← No match found
   └─ lng = NULL
   
   Status field in geocoded CSV: "NO_MATCH"
   
   API response: same as "BEFORE GEOCODING" case
   
   Frontend options:
   ✓ Ask user to verify/correct address
   ✓ Request device location (if user permits)
   ✗ Use verified address coordinates

════════════════════════════════════════════════════════════════════════════════
KEY METRICS
════════════════════════════════════════════════════════════════════════════════

Total voters: 274,656

Expected geocoding results:
  • OK: 240,000 - 260,000 (87-95%)
  • NO_MATCH: 10,000 - 20,000 (4-7%)
  • Other errors: 5,000 (2%)

Performance:
  • Migration execution: < 1 second
  • Export 274k rows to JSON: ~10-15 seconds
  • JSON to CSV conversion: ~5-10 seconds
  • Geocoding (28 batch calls × 10k rows): ~30-60 minutes (includes wait time)
  • Import results into D1: ~5-10 seconds per 10k rows = ~15-30 seconds total

Index impact:
  • idx_voters_addr_norm_lat_lng: ~40-80 MB (depends on geocoded ratio)
  • idx_voters_addr_norm_geocoded: ~10-20 MB
  • Total table growth: ~20-40 MB (from 2 new REAL columns)

════════════════════════════════════════════════════════════════════════════════
