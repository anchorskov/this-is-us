# Delegation API – Implementation Summary

## Overview

Implemented `GET /api/civic/delegation` endpoint to power the "Your Delegation" panel in Civic Watch.

Returns a user's state and federal legislative representatives based on verified voter status or direct voter lookup.

## Files Created

### 1. worker/src/routes/civic/delegation.mjs (114 lines)
**Main handler for GET /api/civic/delegation**

Key functions:
- `handleGetDelegation(request, env)`: Main export
  - Accepts query params: `user_id` or `voter_id`
  - Path 1: Lookup via `verified_users` (preferred)
  - Path 2: Lookup via `voters_addr_norm` (testing/admin)
  - Joins with `wy_legislators` to get state rep/senator details
  - Returns delegation object with source, county, house, senate, federal

- `formatLegislator(row, roleOverride)`: Helper
  - Formats wy_legislators row into standardized legislator object
  - Extracts district, name, role, email, phone, website, bio

Database queries:
```sql
-- Verified user lookup
SELECT voter_id, county, house, senate, status
FROM verified_users
WHERE user_id = ?1 AND status = 'verified'

-- Voter lookup
SELECT house, senate, city_county_id
FROM voters_addr_norm
WHERE voter_id = ?1

-- County lookup
SELECT county FROM wy_city_county WHERE id = ?1

-- State House legislator
SELECT id, name, chamber, district_label, district_number, contact_email, contact_phone, website_url, bio
FROM wy_legislators
WHERE chamber = 'house' AND district_number = ?1

-- State Senate legislator
SELECT id, name, chamber, district_label, district_number, contact_email, contact_phone, website_url, bio
FROM wy_legislators
WHERE chamber = 'senate' AND district_number = ?1
```

### 2. worker/src/lib/federalDelegation.mjs (31 lines)
**Hard-coded federal delegation config**

Exports:
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
    { name: "John Barrasso", ... },
    { name: "Cynthia Lummis", ... },
  ],
}
```

Update when representatives change (elections, reassignments).

### 3. worker/src/index.mjs (MODIFIED)
**Router registration**

Changes:
- Line 59: Added import: `import { handleGetDelegation } from "./routes/civic/delegation.mjs";`
- Line 123: Added route: `router.get("/api/civic/delegation", handleGetDelegation);`

Route is placed with other civic endpoints:
```javascript
router.get("/api/civic/items/:id", handleGetCivicItem);
router.post("/api/civic/items/:id/vote", handleVoteCivicItem);
router.get("/api/civic/openstates/search", handleOpenStatesSearch);
router.get("/api/civic/pending-bills", handlePendingBills);
router.get("/api/civic/pending-bills-with-topics", handlePendingBillsWithTopics);
router.get("/api/civic/bill-sponsors", handleBillSponsors);
router.get("/api/civic/delegation", handleGetDelegation);  // ← NEW
```

## Documentation Files

### CIVIC_WATCH_DELEGATION_API.md (570+ lines)
Comprehensive technical reference including:
- Endpoint URL and query parameters
- Request examples (verified voter, direct lookup, fallback)
- Complete response schema with examples
- Database schema dependencies (verified_users, voters_addr_norm, wy_city_county, wy_legislators)
- Implementation flow diagram
- Field mapping table
- CORS headers configuration
- Frontend integration examples (HTML/JavaScript)
- How to update federal delegation
- Manual testing procedures
- Code locations
- Error handling
- Security notes
- Future enhancements

### DELEGATION_API_EXAMPLES.md (400+ lines)
Concrete example responses for all scenarios:
1. Verified voter with complete delegation
2. Direct voter lookup (admin/testing)
3. No verified voter (fallback with federal only)
4. Database error (HTTP 500)

Plus JavaScript example code for:
- Loading delegation on frontend
- Rendering delegation panel
- Error handling
- Field descriptions

## Architecture

### Query Paths

**Path 1: Verified Voter (Preferred)**
```
Frontend sends: user_id (Firebase UID)
    ↓
Query: verified_users WHERE user_id = ? AND status = 'verified'
    ↓
Get: voter_id, county, house, senate
    ↓
source = "verified_voter"
```

**Path 2: Direct Voter Lookup (Testing/Admin)**
```
Frontend sends: voter_id
    ↓
Query: voters_addr_norm WHERE voter_id = ?
    ↓
Get: house, senate, city_county_id
    ↓
Join: wy_city_county for county name
    ↓
source = "voter_id_lookup"
```

**Path 3: Fallback (No Match)**
```
No user_id or voter_id provided (or not found)
    ↓
Return: source = "none", message = "Please verify your voter account"
    ↓
Still include: federal delegation
```

### Legislator Lookup

```
For house/senate districts found above:
    ↓
Query: wy_legislators WHERE chamber = 'house' AND district_number = ?
    ↓
Format into: { district, name, role, email, phone, website, bio }
    ↓
Repeat for senate
```

### Response Structure

```json
{
  "source": "verified_voter" | "voter_id_lookup" | "none",
  "county": "Laramie" | null,
  "state": "Wyoming",
  "house": { ... } | null,
  "senate": { ... } | null,
  "federal": {
    "house": { ... },
    "senators": [ { ... }, { ... } ]
  }
}
```

## Integration with Civic Watch

### Frontend Code

```javascript
// Load delegation when panel is shown
async function loadDelegation() {
  const userId = getFirebaseUID(); // from auth context
  
  const response = await fetch(
    `/api/civic/delegation?user_id=${encodeURIComponent(userId)}`,
    { credentials: 'include' }
  );
  
  const delegation = await response.json();
  
  if (delegation.source === 'none') {
    showVerificationPrompt(delegation.message);
  } else {
    renderDelegationPanel(delegation);
  }
}

// Render panel with representatives
function renderDelegationPanel(delegation) {
  // State House: delegation.house
  // State Senate: delegation.senate
  // Federal House: delegation.federal.house
  // Federal Senators: delegation.federal.senators[0], [1]
}
```

## Deployment Checklist

- [ ] Review code: `worker/src/routes/civic/delegation.mjs`
- [ ] Review config: `worker/src/lib/federalDelegation.mjs`
- [ ] Verify imports in `worker/src/index.mjs`
- [ ] Test locally: `npm run dev`
  - `GET /api/civic/delegation?user_id=test-uid`
  - `GET /api/civic/delegation?voter_id=WY-2025-00012345`
  - `GET /api/civic/delegation` (no params)
- [ ] Verify wy_legislators table is populated with data
- [ ] Verify verified_users table exists (if using Path 1)
- [ ] Deploy: `npm run deploy`
- [ ] Monitor logs for errors
- [ ] Integrate frontend: Call `/api/civic/delegation` from Civic Watch panel
- [ ] Test end-to-end with verified voter account
- [ ] Update federal delegation when representatives change

## Testing

### Unit Tests
Location: Can be added to `worker/test/civic.delegation.test.mjs`

Should test:
- Verified user lookup returns correct delegation
- Voter ID lookup returns correct delegation
- Fallback (no match) returns federal only
- Database error returns HTTP 500
- Missing required columns handled gracefully

### Manual Tests

```bash
# Test 1: Verified voter
curl "http://localhost:8787/api/civic/delegation?user_id=test-uid-123"

# Test 2: Voter ID
curl "http://localhost:8787/api/civic/delegation?voter_id=WY-2025-00012345"

# Test 3: No match (fallback)
curl "http://localhost:8787/api/civic/delegation"

# Test 4: Both params (user_id takes priority)
curl "http://localhost:8787/api/civic/delegation?user_id=test-uid&voter_id=WY-2025-00012345"
```

## Data Dependencies

Required tables in WY_DB:
1. **voters_addr_norm**: voter_id, house, senate, city_county_id
2. **verified_users**: user_id, voter_id, county, house, senate, status
3. **wy_city_county**: id, city, county, state
4. **wy_legislators**: id, name, chamber, district_number, contact_email, contact_phone, website_url, bio

Migration: `worker/migrations_wy/0013_create_wy_legislators.sql` creates the wy_legislators table.

## Error Handling

| Scenario | Response |
|----------|----------|
| Database connection error | HTTP 500 `{ error: "delegation_lookup_failed", message: "..." }` |
| No verified user found | HTTP 200 `{ source: "none", message: "Please verify..." }` |
| Legislator not found in DB | HTTP 200 with house/senate = null |
| Missing env.WY_DB binding | HTTP 500 (caught in try/catch) |

## Security & Privacy

- **Public endpoint**: No auth required (safe to expose)
- **Data returned**: County + district (public info), no home address
- **Query params**: Visible in logs; use session for production
- **CORS**: Follows global policy (allows all origins)

## Future Enhancements

1. **Live Federal Delegation**: Replace hard-coded values with OpenStates/Congress API
2. **County-only Lookup**: If `wy_legislators.county_assignment` is populated, could return delegation by county alone
3. **Caching**: Redis/KV cache for frequently-accessed legislators
4. **Call Integration**: One-click contact forms for email/phone
5. **Districts Map**: Visualize legislator district boundaries
6. **Audit Trail**: Log delegation lookups for analytics

## Questions?

See:
- **CIVIC_WATCH_DELEGATION_API.md** for complete technical reference
- **DELEGATION_API_EXAMPLES.md** for response examples and frontend code
- **worker/src/routes/civic/delegation.mjs** for implementation details

---

**Status**: ✅ Implementation Complete  
**Date**: December 10, 2025  
**Route**: GET /api/civic/delegation  
**Bindings Required**: WY_DB  
**Auth Required**: No (returns null for unverified)
