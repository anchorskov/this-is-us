// CIVIC WATCH DELEGATION API

## Overview

The `/api/civic/delegation` endpoint returns a user's state and federal legislative delegation based on their verified voter record or a direct voter_id lookup.

This powers the "Your Delegation" panel in Civic Watch, showing:
- **State House** representative (by district)
- **State Senate** member (by district)
- **Federal Delegation** (US House at-large member + 2 US Senators)

## Endpoint

```
GET /api/civic/delegation
```

### Query Parameters

Either `user_id` OR `voter_id` should be provided:

| Parameter | Type   | Description | Source |
|-----------|--------|-------------|--------|
| `user_id` | string | Firebase UID of authenticated user | Session/JWT |
| `voter_id` | string | Direct voter_id lookup (for testing/admin) | voters_addr_norm |

**Priority**: If both are provided, `user_id` is checked first.

## Request Examples

### Option 1: Verified Voter (Authenticated)
```bash
curl "https://api.this-is-us.org/api/civic/delegation?user_id=firebase-uid-12345"
```

The endpoint will:
1. Look up `verified_users` table by `user_id`
2. Check that `status = 'verified'`
3. Extract cached `house`, `senate`, `county` from that row
4. Return delegation with `source: "verified_voter"`

### Option 2: Direct Voter Lookup (Testing/Admin)
```bash
curl "https://api.this-is-us.org/api/civic/delegation?voter_id=WY-2025-00012345"
```

The endpoint will:
1. Look up `voters_addr_norm` by `voter_id`
2. Extract `house`, `senate`, `city_county_id`
3. Join with `wy_city_county` to get county name
4. Return delegation with `source: "voter_id_lookup"`

### Option 3: No Match (Fallback)
```bash
curl "https://api.this-is-us.org/api/civic/delegation"
```

No query parameters provided. Returns:
```json
{
  "source": "none",
  "message": "No verified voter record found. Please verify your voter account.",
  "county": null,
  "state": "Wyoming",
  "house": null,
  "senate": null,
  "federal": { ... }
}
```

## Response Schema

### Success (HTTP 200)

```json
{
  "source": "verified_voter" | "voter_id_lookup" | "none",
  "county": "Laramie" | "Campbell" | null,
  "state": "Wyoming",
  "house": {
    "district": "23",
    "name": "John Smith",
    "role": "State House",
    "email": "john.smith@wylegislature.gov",
    "phone": "+1 (307) 777-7881",
    "website": "https://wylegislature.gov/members/john-smith/",
    "bio": "Representative, District 23"
  },
  "senate": {
    "district": "10",
    "name": "Jane Doe",
    "role": "State Senate",
    "email": "jane.doe@wylegislature.gov",
    "phone": "+1 (307) 777-7882",
    "website": "https://wylegislature.gov/members/jane-doe/",
    "bio": "Senator, District 10"
  },
  "federal": {
    "house": {
      "name": "Harriet Hageman",
      "role": "U.S. House (At-Large)",
      "district": "At-Large",
      "email": "hageman.house.gov",
      "phone": "+1 (202) 225-2311",
      "website": "https://hageman.house.gov",
      "bio": "U.S. Representative, Wyoming At-Large District"
    },
    "senators": [
      {
        "name": "John Barrasso",
        "role": "U.S. Senator",
        "district": "Senior Senator",
        "email": "senator@barrasso.senate.gov",
        "phone": "+1 (202) 224-6441",
        "website": "https://www.barrasso.senate.gov",
        "bio": "Senior Senator, Wyoming"
      },
      {
        "name": "Cynthia Lummis",
        "role": "U.S. Senator",
        "district": "Junior Senator",
        "email": "senator@lummis.senate.gov",
        "phone": "+1 (202) 224-3424",
        "website": "https://www.lummis.senate.gov",
        "bio": "Junior Senator, Wyoming"
      }
    ]
  }
}
```

### Error (HTTP 500)

```json
{
  "error": "delegation_lookup_failed",
  "message": "Database connection error"
}
```

## Database Schema Dependencies

### verified_users (WY_DB)
```sql
CREATE TABLE verified_users (
  user_id TEXT PRIMARY KEY,         -- Firebase UID
  voter_id TEXT NOT NULL UNIQUE,    -- Links to voters_addr_norm
  county TEXT,                      -- Cached for quick lookup
  house TEXT,                       -- State House district number
  senate TEXT,                      -- State Senate district number
  verified_at TEXT NOT NULL,
  status TEXT DEFAULT 'verified',   -- 'verified' | 'revoked'
  created_at TEXT
);
```

### voters_addr_norm (WY_DB)
```sql
CREATE TABLE voters_addr_norm (
  voter_id TEXT PRIMARY KEY,
  house TEXT,                       -- State House district number
  senate TEXT,                      -- State Senate district number
  city_county_id INTEGER,
  ...
);
```

### wy_city_county (WY_DB)
```sql
CREATE TABLE wy_city_county (
  id INTEGER PRIMARY KEY,
  city TEXT,
  county TEXT,
  state TEXT
);
```

### wy_legislators (WY_DB)
```sql
CREATE TABLE wy_legislators (
  id INTEGER PRIMARY KEY,
  name TEXT,
  chamber TEXT,                     -- 'house' | 'senate'
  district_number TEXT,             -- Matches house/senate from voters
  district_label TEXT,              -- Display format
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  bio TEXT,
  created_at TEXT,
  updated_at TEXT,
  legislative_session TEXT
);

-- Primary lookup index
CREATE INDEX idx_wy_legislators_chamber_district 
  ON wy_legislators(chamber, district_number);
```

### federalDelegation (In-Memory Config)
Located in `worker/src/lib/federalDelegation.js`. Hard-coded US House at-large member and 2 US Senators.

## Implementation Details

### Lookup Flow

1. **Input Validation**
   - Check for `user_id` query param OR `voter_id` query param
   - If neither provided, return `source: "none"` with federal delegation only

2. **Path 1: Verified User Lookup** (if `user_id` provided)
   - Query `verified_users WHERE user_id = ?1 AND status = 'verified'`
   - Extract: `voter_id`, `house`, `senate`, `county`
   - Set `source = "verified_voter"`

3. **Path 2: Voter ID Lookup** (if `voter_id` provided and no verified match)
   - Query `voters_addr_norm WHERE voter_id = ?1`
   - Extract: `house`, `senate`, `city_county_id`
   - Join with `wy_city_county` to get county name
   - Set `source = "voter_id_lookup"`

4. **Fallback** (if neither lookup succeeds)
   - Set `source = "none"`
   - Return message prompting voter verification
   - Still include federal delegation

5. **Legislative Lookup** (if house/senate found)
   - Query `wy_legislators WHERE chamber = 'house' AND district_number = ?1`
   - Query `wy_legislators WHERE chamber = 'senate' AND district_number = ?1`
   - Format results using `formatLegislator()` helper

6. **Federal Delegation** (always included)
   - Use hard-coded values from `federalDelegation` constant
   - US House at-large + 2 US Senators

### Field Mapping

| Source | Destination | Notes |
|--------|-------------|-------|
| `wy_legislators.district_number` | `house.district` / `senate.district` | Numeric ID matching voters' `house`/`senate` |
| `wy_legislators.name` | `house.name` / `senate.name` | Full legislator name |
| `wy_legislators.chamber` | Determines role | 'house' → "State House", 'senate' → "State Senate" |
| `wy_legislators.contact_email` | `house.email` / `senate.email` | Office email address |
| `wy_legislators.contact_phone` | `house.phone` / `senate.phone` | Office phone number |
| `wy_legislators.website_url` | `house.website` / `senate.website` | Legislator profile URL |
| `wy_legislators.bio` | `house.bio` / `senate.bio` | Short biography or affiliation |
| `verified_users.county` | `county` | Cached from voter verification |
| `federalDelegation.house` | `federal.house` | Hard-coded at-large representative |
| `federalDelegation.senators` | `federal.senators` | Hard-coded 2 senators |

## CORS Headers

The endpoint respects the global CORS configuration in `worker/src/index.mjs`:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, Stripe-Signature`

## Civic Watch Frontend Integration

### In Your Frontend Code

```javascript
// Fetch delegation when user loads "Your Delegation" panel
async function loadDelegation() {
  const sessionUserId = getFirebaseUID(); // from auth context
  
  const response = await fetch(
    `/api/civic/delegation?user_id=${encodeURIComponent(sessionUserId)}`,
    { credentials: 'include' }
  );
  
  const delegation = await response.json();
  
  if (delegation.source === 'none') {
    showVerificationPrompt();
  } else {
    renderDelegationPanel(delegation);
  }
}
```

### Rendering "Your Delegation"

```html
<div id="delegation-panel">
  <h3>Your Delegation</h3>
  
  <!-- State House -->
  <div class="representative" id="house-rep">
    <h4>{{house.role}} - District {{house.district}}</h4>
    <p><strong>{{house.name}}</strong></p>
    <p><a href="mailto:{{house.email}}">{{house.email}}</a></p>
    <p>{{house.phone}}</p>
    <p><a href="{{house.website}}" target="_blank">View Profile</a></p>
  </div>
  
  <!-- State Senate -->
  <div class="representative" id="senate-rep">
    <h4>{{senate.role}} - District {{senate.district}}</h4>
    <p><strong>{{senate.name}}</strong></p>
    <p><a href="mailto:{{senate.email}}">{{senate.email}}</a></p>
    <p>{{senate.phone}}</p>
    <p><a href="{{senate.website}}" target="_blank">View Profile</a></p>
  </div>
  
  <!-- Federal -->
  <div class="federal-delegation">
    <h4>Federal Delegation</h4>
    
    <!-- US House -->
    <div class="federal-rep">
      <p><strong>{{federal.house.name}}</strong></p>
      <p>{{federal.house.role}}</p>
      <p><a href="{{federal.house.website}}" target="_blank">Contact</a></p>
    </div>
    
    <!-- US Senators -->
    <div class="federal-senators">
      {{#each federal.senators}}
        <div class="senator">
          <p><strong>{{this.name}}</strong></p>
          <p>{{this.role}}</p>
          <p><a href="{{this.website}}" target="_blank">Contact</a></p>
        </div>
      {{/each}}
    </div>
  </div>
</div>

<!-- Fallback: Not Verified -->
<div id="delegation-prompt" style="display: none;">
  <p>To see your representatives, please verify your voter account.</p>
  <button onclick="goToVoterVerification()">Verify Account</button>
</div>
```

## Updating Federal Delegation

Edit `worker/src/lib/federalDelegation.js`:

```javascript
export const federalDelegation = {
  house: {
    name: "Harriet Hageman",
    role: "U.S. House (At-Large)",
    district: "At-Large",
    email: "hageman.house.gov",
    phone: "+1 (202) 225-2311",
    website: "https://hageman.house.gov",
    bio: "U.S. Representative, Wyoming At-Large District",
  },
  senators: [
    { /* Senior Senator */ },
    { /* Junior Senator */ },
  ],
};
```

**Future Enhancement**: Replace with live OpenStates or Congress API calls to auto-update on elections/reassignments.

## Testing

### Manual Test 1: Verified Voter
```bash
# First, create a verified_users record
./scripts/wr d1 execute WY_DB --command "
  INSERT INTO verified_users (user_id, voter_id, county, house, senate, verified_at, status)
  VALUES ('test-uid-123', 'WY-2025-00012345', 'Laramie', '23', '10', datetime('now', 'utc'), 'verified');
"

# Then fetch delegation
curl "http://localhost:8787/api/civic/delegation?user_id=test-uid-123"
```

Expected response:
```json
{
  "source": "verified_voter",
  "county": "Laramie",
  "house": { ... },
  "senate": { ... },
  "federal": { ... }
}
```

### Manual Test 2: Direct Voter Lookup
```bash
# Find an existing voter_id
curl "http://localhost:8787/api/civic/delegation?voter_id=WY-2025-00012345"
```

Expected response with `"source": "voter_id_lookup"`.

### Manual Test 3: No Match
```bash
curl "http://localhost:8787/api/civic/delegation"
```

Expected response:
```json
{
  "source": "none",
  "message": "No verified voter record found. Please verify your voter account.",
  "county": null,
  "house": null,
  "senate": null,
  "federal": { ... }
}
```

## Code Locations

| File | Purpose |
|------|---------|
| `worker/src/routes/civic/delegation.mjs` | Main handler for GET /api/civic/delegation |
| `worker/src/lib/federalDelegation.js` | Hard-coded US House and Senator data |
| `worker/src/index.mjs` | Router registration (line ~120) |

## Error Handling

- **Database error** → HTTP 500 with `{ error: "delegation_lookup_failed", message: "..." }`
- **No verified user / voter found** → HTTP 200 with `{ source: "none", ... }`
- **Missing required binding (WY_DB)** → HTTP 500 (caught in try/catch)
- **Malformed query params** → Treated as "no match" (safely ignored)

## Security Notes

- **Public endpoint**: No authentication required (returns null for unverified users)
- **Query param exposure**: `user_id` or `voter_id` are visible in logs; safe for admin/testing but not for user-facing URLs (use session instead)
- **Data privacy**: County and legislative district are public information; address is not returned
- **CORS**: Follows global CORS policy (allows all origins for read operations)

## Future Enhancements

1. **Live Federal Delegation**: Replace hard-coded senators/house with OpenStates API calls
2. **County-to-District Mapping**: If `wy_legislators.county_assignment` is populated (Phase 2b), could return delegation by county alone (no voter verification needed)
3. **Caching**: Add Redis/KV cache for frequently-accessed legislators (updates only on elections)
4. **Delegation History**: Track past representatives for historical context
5. **Email/Call Integration**: Add helper to open email client or pre-fill contact forms
6. **Districts Map**: Render district boundaries with legislator overlays

---

**Last Updated**: December 10, 2025
**Endpoint Status**: ✅ Deployed
