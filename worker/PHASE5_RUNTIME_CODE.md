════════════════════════════════════════════════════════════════════════════════
PHASE 5: RUNTIME INTEGRATION CODE
Ready to copy/paste into worker source files
════════════════════════════════════════════════════════════════════════════════

After Phase 4 (geocoding results imported into D1), add these functions and
update your handler code to use lat/lng coordinates.

════════════════════════════════════════════════════════════════════════════════
FILE 1: worker/src/lib/voterVerification.mjs
═════════════════════════════════════════════════════════════════════════════════

ADD THIS FUNCTION to the file (near existing voter verification helpers):

/**
 * Get complete location info for a verified voter
 * Queries voters_addr_norm for verified address and geocoded coordinates
 * 
 * @param {object} env - Cloudflare Worker environment (env.WY_DB)
 * @param {string} voterId - Voter ID to look up
 * @returns {object|null} Complete location object or null if not found
 * 
 * Returns:
 * {
 *   voterId: string,
 *   homeLocation: {
 *     city: string,
 *     state: string,
 *     zip: string,
 *     county: string,
 *     coordinates: { lat: number, lng: number } | null
 *   },
 *   districts: {
 *     house: string,
 *     senate: string
 *   }
 * }
 */
export async function getVerifiedUserLocation(env, voterId) {
  if (!voterId || !env.WY_DB) {
    return null;
  }
  
  try {
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
    
    if (!result) {
      return null;
    }
    
    return {
      voterId: result.voter_id,
      homeLocation: {
        city: result.city,
        state: result.state || 'WY',
        zip: result.zip,
        county: result.county_name,
        // Only include coordinates if both lat and lng are present
        coordinates: (result.lat !== null && result.lng !== null)
          ? { lat: result.lat, lng: result.lng }
          : null
      },
      districts: {
        house: result.house,
        senate: result.senate
      }
    };
  } catch (error) {
    console.error(`Error fetching verified user location for ${voterId}:`, error);
    return null;
  }
}

════════════════════════════════════════════════════════════════════════════════
FILE 2: worker/src/routes/voters.js
═════════════════════════════════════════════════════════════════════════════════

UPDATE the handleVoterLookup function to use the new helper:

// ADD THIS IMPORT at the top of the file (if not already present)
import { getVerifiedUserLocation } from '../lib/voterVerification.mjs';

// THEN, in your handleVoterLookup function, after successful voter verification:
// Replace or add this section:

export async function handleVoterLookup(request, env) {
  // ... existing verification code ...
  
  // After verifying voter identity, get complete location info
  const location = await getVerifiedUserLocation(env, verifiedVoterId);
  
  if (!location) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Verified voter not found in records',
        voter_id: verifiedVoterId
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Check if coordinates are available
  const hasCoordinates = location.homeLocation.coordinates !== null;
  
  // Build response with location data
  const responseData = {
    success: true,
    voter_id: location.voterId,
    homeLocation: {
      city: location.homeLocation.city,
      state: location.homeLocation.state,
      zip: location.homeLocation.zip,
      county: location.homeLocation.county,
      coordinates: location.homeLocation.coordinates
    },
    districts: {
      house: location.districts.house,
      senate: location.districts.senate
    },
    geolocationStatus: hasCoordinates ? 'verified_address' : 'ungeocoded'
  };
  
  // Optional: log geolocation status for analytics
  if (hasCoordinates) {
    console.log(`✅ Verified voter has geocoded address:`, {
      voter_id: location.voterId,
      city: location.homeLocation.city,
      county: location.homeLocation.county,
      lat: location.homeLocation.coordinates.lat,
      lng: location.homeLocation.coordinates.lng
    });
  } else {
    console.log(`⚠️ Verified voter awaiting geocoding:`, {
      voter_id: location.voterId,
      city: location.homeLocation.city,
      county: location.homeLocation.county
    });
  }
  
  return new Response(
    JSON.stringify(responseData),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

════════════════════════════════════════════════════════════════════════════════
FILE 3: worker/src/routes/voters.js (ALTERNATIVE - Minimal Changes)
════════════════════════════════════════════════════════════════════════════════

If you want to keep changes minimal and not refactor the entire handler,
just add this snippet after your existing voter lookup:

// After existing voter verification succeeds (you have verified_voter_id):

const { getVerifiedUserLocation } = await import('../lib/voterVerification.mjs');
const location = await getVerifiedUserLocation(env, verified_voter_id);

// Then when building your response, add:
if (location && location.homeLocation.coordinates) {
  // Verified voter has geocoded coordinates
  response.homeLocation.coordinates = location.homeLocation.coordinates;
  response.geolocationStatus = 'verified_address';
  
  // Optional: skip device location request in frontend
  response.deviceLocationOptional = true;
} else if (location) {
  // Voter verified but not yet geocoded
  response.geolocationStatus = 'ungeocoded';
  response.deviceLocationOptional = false; // May need device location
}

════════════════════════════════════════════════════════════════════════════════
FRONTEND INTEGRATION (Example usage in your web app)
════════════════════════════════════════════════════════════════════════════════

After voter verification API call, use coordinates if available:

// POST /api/voters/lookup returns:
{
  "success": true,
  "voter_id": "WY00001",
  "homeLocation": {
    "city": "Cheyenne",
    "state": "WY",
    "zip": "82001",
    "county": "Laramie",
    "coordinates": { "lat": 41.1400, "lng": -104.8202 }  // NEW!
  },
  "districts": {
    "house": "15",
    "senate": "02"
  },
  "geolocationStatus": "verified_address"  // NEW! Can be "verified_address" or "ungeocoded"
}

Frontend logic:

// Check if we have verified coordinates
if (voterLocation.homeLocation.coordinates) {
  // Use verified coordinates for map, proximity features, etc.
  const { lat, lng } = voterLocation.homeLocation.coordinates;
  
  console.log(`✅ Using verified address coordinates: ${lat}, ${lng}`);
  
  // Initialize map with verified location
  initializeMap(lat, lng);
  
  // Find nearest representatives without device location
  findNearestReps(lat, lng);
  
  // Show county badge
  showCountyBadge(voterLocation.homeLocation.county);
  
  // Skip device location permission request (optional)
  // Skip: requestDeviceLocation();
  
} else if (voterLocation.geolocationStatus === 'ungeocoded') {
  // Voter verified but address not yet geocoded
  console.log(`⚠️ Address not yet geocoded. Requesting device location...`);
  
  // Offer device location request
  const deviceLocation = await requestDeviceLocation();
  if (deviceLocation) {
    // Use device location as fallback
    initializeMap(deviceLocation.lat, deviceLocation.lng);
  }
} else {
  // Unverified user - must request device location
  const deviceLocation = await requestDeviceLocation();
  if (!deviceLocation) {
    showError('Geolocation permission required for proximity features');
  }
}

════════════════════════════════════════════════════════════════════════════════
API SCHEMA UPDATE (Document for your API specs)
════════════════════════════════════════════════════════════════════════════════

Update your API documentation with the new response schema:

GET /api/voters/lookup
POST /api/voters/verify

Response 200 OK:
{
  "success": boolean,
  "voter_id": string,
  "homeLocation": {
    "city": string,
    "state": string,        // "WY"
    "zip": string,          // "82001"
    "county": string,       // e.g., "Laramie", "Albany"
    "coordinates": {        // NEW! null if not yet geocoded
      "lat": number,        // latitude (decimal degrees)
      "lng": number         // longitude (decimal degrees)
    } | null
  },
  "districts": {
    "house": string,        // e.g., "15"
    "senate": string        // e.g., "02"
  },
  "geolocationStatus": string,  // NEW! "verified_address" | "ungeocoded"
  "deviceLocationOptional": boolean  // NEW! true if coordinates available
}

Notes:
  • coordinates will be null for voters not yet geocoded
  • geolocationStatus guides frontend decision:
    - "verified_address": Use coordinates, skip device location
    - "ungeocoded": Offer optional device location
  • deviceLocationOptional: Frontend can skip device location request if true

════════════════════════════════════════════════════════════════════════════════
TESTING CHECKLIST
════════════════════════════════════════════════════════════════════════════════

After adding code, test:

□ Unit Tests (voterVerification.mjs)
  ✓ getVerifiedUserLocation returns null for unknown voter
  ✓ getVerifiedUserLocation returns coordinates for geocoded voter
  ✓ getVerifiedUserLocation returns null for coordinates if lat=NULL
  ✓ getVerifiedUserLocation handles missing WY_DB gracefully
  ✓ getVerifiedUserLocation joins with wy_city_county correctly

□ Integration Tests (voters.js)
  ✓ handleVoterLookup returns coordinates in response
  ✓ handleVoterLookup handles ungeocoded voters
  ✓ handleVoterLookup sets geolocationStatus correctly
  ✓ API response schema matches documentation
  ✓ Logging works (check console for ✅ / ⚠️ messages)

□ End-to-End Tests (Frontend)
  ✓ Frontend receives coordinates in API response
  ✓ Frontend skips device location request when coordinates present
  ✓ Frontend shows county badge correctly
  ✓ Frontend initializes map with coordinates
  ✓ Frontend handles null coordinates gracefully

□ Data Quality Checks
  ✓ SELECT COUNT(*) FROM voters_addr_norm WHERE lat IS NOT NULL;
     (Should be ~240k-260k if geocoding complete)
  ✓ Spot check: SELECT * FROM voters_addr_norm WHERE lat IS NOT NULL LIMIT 5;
     (Verify coordinates are in Wyoming bounds)
  ✓ SELECT COUNT(*) FROM voters_addr_norm WHERE lat IS NULL AND state='WY';
     (Check ungeocoded count)

════════════════════════════════════════════════════════════════════════════════
PERFORMANCE NOTES
════════════════════════════════════════════════════════════════════════════════

Query Performance:
  • getVerifiedUserLocation: O(1) with index on voter_id (PRIMARY KEY)
  • Execution time: <10ms typical
  • No full table scans
  • LEFT JOIN with wy_city_county is fast (indexed)

Index Impact:
  • idx_voters_addr_norm_lat_lng: Used for proximity queries (future features)
  • Partial index (WHERE NOT NULL) keeps size lean
  • No impact on voter_id lookups (already PRIMARY KEY)

Caching Opportunity:
  If you make many requests for same voter, consider caching:

  const locationCache = new Map();
  
  async function getVerifiedUserLocationCached(env, voterId, ttl = 3600000) {
    if (locationCache.has(voterId)) {
      const cached = locationCache.get(voterId);
      if (Date.now() - cached.timestamp < ttl) {
        return cached.data;
      }
    }
    
    const location = await getVerifiedUserLocation(env, voterId);
    locationCache.set(voterId, { data: location, timestamp: Date.now() });
    return location;
  }

════════════════════════════════════════════════════════════════════════════════
DEBUGGING
════════════════════════════════════════════════════════════════════════════════

If coordinates not returning in response:

1. Check that migration was applied:
   npx wrangler d1 execute WY_DB --local --command ".schema voters_addr_norm"
   (Should see lat, lng columns)

2. Check that data was imported:
   npx wrangler d1 execute WY_DB --local --command "SELECT COUNT(*) FROM voters_addr_norm WHERE lat IS NOT NULL;"
   (Should be > 0)

3. Test the helper function directly:
   const location = await getVerifiedUserLocation(env, 'WY00001');
   console.log(JSON.stringify(location, null, 2));

4. Check database connection:
   npx wrangler d1 execute WY_DB --local --command "SELECT COUNT(*) FROM voters_addr_norm;"
   (Should return ~274,656)

5. Verify voter exists:
   npx wrangler d1 execute WY_DB --local --command "SELECT voter_id, lat, lng FROM voters_addr_norm WHERE voter_id = 'WY00001';"
   (Should return row with lat/lng if geocoded)

════════════════════════════════════════════════════════════════════════════════
ROLLBACK PLAN
════════════════════════════════════════════════════════════════════════════════

If you need to rollback all changes:

1. Remove code from voters.js (undo the import and helper calls)
2. Remove getVerifiedUserLocation() from voterVerification.mjs
3. (Optional) Drop migration: CREATE MIGRATION file with DROP COLUMN
4. No data loss, just revert to pre-migration state

The migration itself doesn't change any existing queries, so rollback is
straightforward. Old code continues to work even with new columns present.

════════════════════════════════════════════════════════════════════════════════
QUESTIONS?
════════════════════════════════════════════════════════════════════════════════

• Migration syntax: See GEOCODING_WORKFLOW.md section 1
• Geocoding workflow: See GEOCODING_WORKFLOW.md sections 2-4
• CSV schemas: See VOTERS_ADDR_NORM_CHECKLIST.txt
• Visual overview: See GEOCODING_VISUAL_GUIDE.md
• Quick commands: See VOTERS_ADDR_NORM_CHECKLIST.txt "QUICK COMMANDS"

════════════════════════════════════════════════════════════════════════════════
