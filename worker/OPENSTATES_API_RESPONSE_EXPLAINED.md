# OpenStates API v3 Response Structure - Wyoming Bills

**API Endpoint:** `https://v3.openstates.org/bills`  
**Sample Query:** `?jurisdiction=Wyoming&session=2025&per_page=2`  
**Authentication:** X-API-KEY header  
**Date Fetched:** December 10, 2025

---

## Response Overview

The OpenStates API returns bills with the following top-level structure:

```json
{
  "results": [...],     // Array of bill objects
  "pagination": {...}   // Pagination metadata
}
```

---

## Bill Object Structure

Each bill in the `results` array contains:

### Core Bill Information

| Field | Type | Example | Usage |
|-------|------|---------|-------|
| `id` | String (OCD URI) | `ocd-bill/3bf03922-22fb-406e-a83b-54f93849e03f` | Unique identifier, used in detail requests |
| `session` | String | `2025` | Legislative session year |
| `identifier` | String | `HB 22` | Bill number (HB = House, SF = Senate) |
| `title` | String | `Water and wastewater operator-emergency response.` | Full bill title |
| `classification` | Array | `["bill"]` | Bill type (always "bill" for bills) |

### Jurisdiction Information

```json
"jurisdiction": {
  "id": "ocd-jurisdiction/country:us/state:wy/government",
  "name": "Wyoming",
  "classification": "state"
}
```

**Usage:** Validates that bill is from Wyoming (check `jurisdiction.name === "Wyoming"`)

### Chamber Information

```json
"from_organization": {
  "id": "ocd-organization/683ca907-05d4-4c84-8d7b-f04f73e295ad",
  "name": "House",
  "classification": "lower"
}
```

**Fields:**
- `name`: "House" or "Senate"
- `classification`: "lower" (House) or "upper" (Senate)

**Usage Notes:**
- ⚠️ **Not reliable for chamber detection** - this field doesn't distinguish HB vs SF
- ✅ **Better approach:** Parse `identifier` prefix (HB = house, SF = senate)
- See: `worker/src/lib/openStatesSync.mjs` → `normalizeChamber()` function

### Subject/Topic Information

```json
"subject": []
```

**Status:** Currently EMPTY for Wyoming bills  
**Limitation:** OpenStates API v3 doesn't populate subject data for Wyoming  
**Workaround:** Use AI-based topic detection (gpt-4o-mini) instead

### Extra Wyoming-Specific Data

```json
"extras": {
  "chapter": "CH0032",
  "wy_bill_id": 12109,
  "effective_date": "2025-02-24",
  "wy_enrolled_number": "HEA0005"
}
```

**Fields:**
- `chapter`: Wyoming legislative chapter number (assigned when passed)
- `wy_bill_id`: Internal Wyoming legislative ID
- `effective_date`: When bill became effective
- `wy_enrolled_number`: Wyoming enrolled bill number (HEA/SEA prefix)

### Timestamps

| Field | Type | Usage |
|-------|------|-------|
| `created_at` | ISO 8601 | When bill was added to OpenStates |
| `updated_at` | ISO 8601 | Last sync from Wyoming legislature |
| `first_action_date` | ISO 8601 | First legislative action |
| `latest_action_date` | ISO 8601 | Most recent action |

### Action Information

```json
"latest_action_date": "2025-02-25T00:55:14+00:00",
"latest_action_description": "Assigned Chapter Number 32",
"latest_passage_date": "2025-02-18T18:07:20+00:00"
```

**Fields:**
- `latest_action_description`: Text description of most recent action
- `latest_passage_date`: When bill passed (useful for status detection)

**Usage:** Determine bill status (introduced, in_committee, pending_vote, passed, failed)

### External References

```json
"openstates_url": "https://openstates.org/wy/bills/2025/HB22/"
```

**Usage:** Link to bill on openstates.org website

### NOT in List Response

The following fields are NOT returned in the `/bills` list endpoint but ARE available in the detail endpoint (`/bills/{id}?include=sponsorships`):

- `sponsorships` - Sponsor information (person, role, classification)
- `actions` - Full action history (not just latest)
- `versions` - Bill text versions
- `sources` - Source links
- `abstracts` - Bill abstracts/summaries

---

## Key Limitations for Wyoming

### 1. Empty Subject Array
**Impact:** Cannot use API-provided topics  
**Solution:** Use AI-based topic detection (gpt-4o-mini in our system)

### 2. Organization/Chamber Not Distinctive
**Issue:** `from_organization.name` is always "House" even for Senate bills  
**Solution:** Use bill `identifier` prefix (HB vs SF) as PRIMARY chamber detection method

### 3. No Abstracts in List Response
**Impact:** Must use detail endpoint to get full bill information  
**Solution:** Our sync calls detail endpoint for each bill (see `getDetailedBillInfo()`)

### 4. Limited Action History in List
**Impact:** Latest action only in list response  
**Solution:** Use `latest_action_date`, `latest_passage_date` to determine status
**Status Determination Logic:**
```javascript
if (actions.some(a => a.includes('withdrawal') || a.includes('failure'))) 
  return 'failed';
if (latestPassageDate && hasMultipleChamberPassages) 
  return 'passed';
if (actions.some(a => a.includes('passage'))) 
  return 'pending_vote';
if (actions.some(a => a.includes('committee'))) 
  return 'in_committee';
return 'introduced';
```

---

## Pagination

```json
"pagination": {
  "per_page": 2,
  "page": 1,
  "max_page": 278,
  "total_items": 556
}
```

**Interpretation:**
- **total_items: 556** - Total Wyoming bills in 2025 session
- **max_page: 278** - 556 bills / 2 per_page = 278 pages
- **page: 1** - Currently on page 1
- **per_page: 2** - Requesting 2 bills per page

**Query Parameters:**
```
?jurisdiction=Wyoming
&session=2025
&per_page=20        # Default is 20, max is usually 100
&page=1             # Starting page
&sort=updated_desc  # Sort by most recently updated
```

---

## Full Detail Endpoint Response

To get sponsorships, use:
```
GET /bills/{bill_id}?include=sponsorships
```

**Additional Fields in Detail Response:**

```json
{
  "sponsorships": [
    {
      "name": "Campbell",
      "classification": "primary",
      "entity_type": "person",
      "person_id": "ocd-person/deadbeef-beef-beef-beef-deadbeefbeef",
      "primary": true
    },
    ...
  ],
  "actions": [
    {
      "date": "2024-12-09T16:58:36+00:00",
      "description": "Introduced in House",
      "classification": ["introduction"],
      "organization": {"name": "House", ...},
      "from_organization": {"name": "House", ...}
    },
    ...
  ],
  "versions": [
    {
      "note": "Introduced",
      "date": "2024-12-09T00:00:00+00:00",
      "links": [
        {
          "media_type": "application/pdf",
          "url": "https://..."
        }
      ]
    }
  ],
  "sources": [
    {
      "url": "https://www.wyoleg.gov/...",
      "note": "Wyoming Legislature website"
    }
  ]
}
```

---

## Implementation Reference

See how our code uses this API response:

**File:** `worker/src/lib/openStatesSync.mjs`

**Key Functions:**
- `syncWyomingBills()` - Calls list endpoint, processes results
- `getDetailedBillInfo()` - Calls detail endpoint for sponsorships
- `normalizeChamber()` - Detects chamber from identifier (HB/SF)
- `statusFromActions()` - Determines bill status from action descriptions

**Data Mapping:**
```javascript
// From OpenStates API to civic_items table
bill_number: bill.identifier              // "HB 22"
title: bill.title
chamber: normalizeChamber(bill.from_organization, bill.identifier)
jurisdiction_key: "WY"                    // Validated from bill.jurisdiction.name
legislative_session: bill.session
status: statusFromActions(bill.actions)   // Or use latest_action_description
summary: bill.abstracts?.[0]?.abstract    // Usually null for Wyoming
external_ref_id: bill.id                  // OCD URI
external_url: bill.openstates_url
created_at: bill.created_at
updated_at: bill.updated_at
```

---

## Testing the API Locally

```bash
# List endpoint (first 2 bills)
curl -s "https://v3.openstates.org/bills?jurisdiction=Wyoming&session=2025&per_page=2" \
  -H "X-API-KEY: YOUR_KEY" | jq .

# Detail endpoint (with sponsorships)
BILL_ID="ocd-bill/3bf03922-22fb-406e-a83b-54f93849e03f"
curl -s "https://v3.openstates.org/bills/${BILL_ID}?include=sponsorships" \
  -H "X-API-KEY: YOUR_KEY" | jq .

# Count all Wyoming bills in 2025
curl -s "https://v3.openstates.org/bills?jurisdiction=Wyoming&session=2025&per_page=1" \
  -H "X-API-KEY: YOUR_KEY" | jq '.pagination.total_items'
```

---

## Important Notes

### API Key
- Stored in `worker/./scripts/wr.toml` → `OPENSTATES_API_KEY`
- Must be included in X-API-KEY header
- Rate limit: ~60 requests per minute (tested, works fine for batch ops)

### Rate Limiting
- Batch operations should include delays between requests
- Our sync includes brief delays to avoid hitting limits
- Detail endpoint (sponsorships) adds 1 call per bill

### Data Freshness
- OpenStates data synced from Wyoming Legislature periodically
- `updated_at` shows last sync time from state legislature
- Not real-time - may be 1-2 hours behind actual legislature

### Wyoming-Specific Notes
- Wyoming legislature has unique numbering (HEA/SEA for enrolled bills)
- Session numbers align with calendar year (2025 session = 2025)
- Bills are available immediately when introduced (quick API availability)
- Final actions (chapter numbers, effective dates) added when passed

---

## Sample JSON Response

See: `OPENSTATES_API_RESPONSE_SAMPLE.json` in this directory

---

**Last Updated:** December 10, 2025  
**API Version:** v3  
**Status:** ✅ Current and tested
