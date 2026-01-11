# Wyoming Voter Geocoding Results Summary

## Overview
Successfully geocoded Wyoming voter addresses using the U.S. Census Batch Geocoder API with configurable rate limiting and retry logic.

## Data Processing

### Source Data
- **File**: `/home/anchor/projects/grassrootsmvt/imports/voters_addr_norm11-30.csv`
- **Total records**: 274,655 Wyoming voters
- **Columns**: voter_id, street_index_id, addr1working, addr1, city, city_county_id, senate, house

### Address Filtering Strategy
The source data had inconsistent address formats. We implemented a strict filter:

1. **Valid Street Addresses (334 records)**: 
   - Pattern: house number (1-4 digits) + space + street name
   - Examples: "1 N FORK RD", "2 S HWY 59", "7 BAR 7 DR"
   - **Status**: ✅ Successfully geocoded (36.5% match rate)

2. **Problematic Addresses (274,321 records)**:
   - Building/landmark names without house numbers
   - Examples: "WHITE HALL", "TOWN HALL", "S 9TH ST"
   - **Status**: ⏳ Waiting for mailing address mappings
   - **Fallback strategy**: Map to known addresses (e.g., University of Wyoming buildings → 1000 E University Ave)

### Geocoding Results

#### Valid Street Addresses (334 records)
```
Total processed: 334
Successful matches (OK): 122
No matches found: 212
Success rate: 36.5%
```

**Output files:**
- `data/voters_addr_norm_geocoded_final.csv` - 122 records with coordinates (lat, lng)
- `data/voters_addr_norm_geocode_errors_final.csv` - 212 records that didn't match

#### Problematic Addresses (108 WHITE HALL variants)
```
Total processed: 108
Successful matches (OK): 0
No matches found: 108
Success rate: 0.0%
```
**Note**: Fallback address "1000 E UNIVERSITY AVE" didn't match Census database. Need to find actual registered address or update mapping.

## Technical Implementation

### Geocoding Script
**File**: `scripts/geocode_voters_addr_norm.py`

**Features:**
- ✅ Configurable rate limiting (default: 0.3 sec between requests)
- ✅ Exponential backoff with jitter for transient errors
- ✅ Batch processing (default: 250 addresses per Census API request)
- ✅ Progress logging to stderr
- ✅ Retry logic for HTTP 429, 502, 503, 504 errors
- ✅ Clean dataclass-based structure

**CLI Arguments:**
```bash
--request-interval-seconds   # Delay between requests (default: 0.3)
--batch-size                # Addresses per batch (default: 250, max: 10000)
--max-retries               # Retry attempts (default: 5)
--backoff-base-seconds      # Exponential backoff base (default: 1.0)
--backoff-max-seconds       # Max backoff delay (default: 30.0)
```

### Address Preparation Scripts
1. **`scripts/prepare_voters_for_geocoding.py`**
   - Filters to valid street addresses only
   - Adds zip codes from city mapping
   - Skips addresses without house numbers
   
2. **`scripts/prepare_problematic_addresses.py`**
   - Identifies building/landmark addresses
   - Maps to known mailing addresses
   - Preserves original address for reference

## Data Schema

### Input CSV Format
```
voter_id, addr1, city, state, zip
```

### Output CSV Format (Successful)
```
voter_id, lat, lng, status
```
Example:
```
51191,43.151720716824,-108.519605668572,OK
```

### Output CSV Format (Errors)
```
voter_id, addr1, city, state, zip, status, error_reason
```

## Next Steps

### Immediate
1. **Import coordinates to database**: Load 122 geocoded records into WY_DB voters_addr_norm table
   ```sql
   UPDATE voters_addr_norm 
   SET lat = ?, lng = ? 
   WHERE voter_id = ? AND status = 'OK'
   ```

2. **Investigate problematic addresses**: 
   - Get actual mailing addresses for WHITE HALL building and other landmarks
   - Update BUILDING_MAILING_ADDRESSES mapping
   - Re-run geocoding for 108 records

### Phase 2
- Geocode remaining unmapped addresses (274,213 records) once mailing addresses available
- Create district assignment query using ST_DWithin or similar spatial functions
- Cache results for performance

## Performance Notes

- Census API respects rate limiting with configurable delays
- Batch size of 250 = ~40 bytes per address = ~10KB per request
- At 0.3 sec/request + processing, ~334 addresses ≈ 30 seconds
- Full 274,655 addresses at same rate ≈ ~2.3 hours

## Files Created/Modified

| File | Purpose | Status |
|------|---------|--------|
| `scripts/prepare_voters_for_geocoding.py` | Filter and prepare valid addresses | ✅ Complete |
| `scripts/prepare_problematic_addresses.py` | Handle building addresses with fallback | ✅ Complete |
| `scripts/geocode_voters_addr_norm.py` | Census API batch geocoder | ✅ Complete |
| `data/voters_addr_norm_to_geocode.csv` | Input: 334 valid addresses | ✅ Generated |
| `data/voters_addr_norm_geocoded_final.csv` | Output: 122 successful geocodes | ✅ Generated |
| `data/voters_addr_norm_geocode_errors_final.csv` | Output: 212 no-match records | ✅ Generated |
| `data/voters_addr_problematic_to_geocode.csv` | Input: 108 WHITE HALL addresses | ✅ Generated |

## Database Migration Ready

Once data is validated, create migration:
```sql
-- 0015_import_geocoded_voters_addr_norm.sql
UPDATE voters_addr_norm SET lat = ?, lng = ? 
WHERE voter_id IN (SELECT voter_id FROM geocoded_results WHERE status = 'OK');
```

