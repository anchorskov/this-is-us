## Phase 2: Sponsors & Delegation Data Model

**Status**: 🔵 Designed (Ready for Migration & API Implementation)  
**Scope**: Bill sponsor tracking + "Your delegation" card foundation  
**Target Timeline**: Week 2-3 of 2025 development cycle

---

### Phase 2 Overview

Phase 2 extends Civic Watch with **legislative relationship data** to answer:
- **"Who introduced this bill?"** → Bill sponsors with contact links
- **"How do I reach my representatives?"** → Delegation preview based on county

This foundation enables future features like:
- Automatic "contact your rep" buttons on bills matching user topics
- Delegation tracking across sessions (multi-year)
- Legislator voting history on user's priority topics

**Key Design Principle**: Keep it simple and county-based for Phase 2. Full geocoding (address → district mapping) deferred to Phase 2b if needed.

---

### Phase 2 Tables

#### 1. bill_sponsors – Track Bill Sponsors & Cosponsors
**Migration**: `worker/migrations_wy/0012_create_bill_sponsors.sql`  
**Status**: 🟡 Designed (not yet applied)

```sql
CREATE TABLE bill_sponsors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  civic_item_id TEXT NOT NULL,                -- FK to civic_items(id)
  sponsor_name TEXT NOT NULL,                 -- Full legislator name: "John Smith"
  sponsor_role TEXT NOT NULL,                 -- "primary" | "cosponsor" | "committee"
  sponsor_district TEXT,                      -- "HD-23" | "SF-10" | NULL for at-large
  chamber TEXT,                               -- "house" | "senate" (denormalized for speed)
  contact_email TEXT,                         -- legislator@wylegislature.gov (if available)
  contact_phone TEXT,                         -- Legislator's office phone (if available)
  contact_website TEXT,                       -- Link to legislator profile or website
  created_at TEXT NOT NULL,                   -- ISO 8601 timestamp
  updated_at TEXT NOT NULL,                   -- ISO 8601 timestamp for amendment tracking
  FOREIGN KEY (civic_item_id) REFERENCES civic_items(id) ON DELETE CASCADE
);

CREATE INDEX idx_bill_sponsors_civic_item ON bill_sponsors(civic_item_id);
CREATE INDEX idx_bill_sponsors_sponsor_name ON bill_sponsors(sponsor_name);
CREATE INDEX idx_bill_sponsors_district ON bill_sponsors(sponsor_district);
```

**Key insights**:
- One row per sponsor-bill pair (bills can have multiple sponsors)
- Denormalized `chamber` field for fast filtering without joining `wy_legislators`
- `sponsor_role` supports future filtering ("Show me only primary sponsors")
- `FOREIGN KEY ... ON DELETE CASCADE` ensures referential integrity (delete sponsors if bill deleted)
- Indexed on `civic_item_id` for fast bill→sponsors lookups (required for bill detail cards)

**Data population strategy**:
- Initial seed: Manual import from OpenStates legislator + bill data (one-time)
- Updates: Whenever bill status changes or new sponsors added (sync with OpenStates)
- Maintenance: Refresh legislator contact info 1x per legislative session

---

#### 2. wy_legislators – Legislative Directory with Contact Info
**Migration**: `worker/migrations_wy/0013_create_wy_legislators.sql`  
**Status**: 🟡 Designed (not yet applied)

```sql
CREATE TABLE wy_legislators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seat_id TEXT NOT NULL UNIQUE,               -- Unique legislator identifier: "H-23" | "S-10"
  name TEXT NOT NULL,                         -- Full legislator name: "John Smith"
  chamber TEXT NOT NULL,                      -- "house" | "senate"
  district_label TEXT NOT NULL,               -- Display-friendly: "House District 23"
  district_number TEXT,                       -- "23" or "10" (numeric for internal use)
  county_assignment TEXT,                     -- JSON array of counties: ["Natrona","Johnson"] (Phase 2b)
  contact_email TEXT,                         -- legislator@wylegislature.gov
  contact_phone TEXT,                         -- Legislator's office phone
  website_url TEXT,                           -- Link to legislator profile
  bio TEXT,                                   -- Short bio / party affiliation (optional)
  created_at TEXT NOT NULL,                   -- ISO 8601 timestamp
  updated_at TEXT NOT NULL,                   -- Updated when contact info changes
  legislative_session TEXT                    -- "2025" (for future multi-year tracking)
);

CREATE INDEX idx_wy_legislators_chamber_district ON wy_legislators(chamber, district_label);
CREATE INDEX idx_wy_legislators_seat_id ON wy_legislators(seat_id);
CREATE INDEX idx_wy_legislators_name ON wy_legislators(name);
```

**Key insights**:
- One row per legislator per session (enables multi-year historical tracking)
- `seat_id` is the unique identifier (e.g., "H-23"); immutable across updates
- `county_assignment` is a JSON array for flexibility (one rep might cover multiple counties)
  - Example: `["Natrona", "Johnson"]`
  - Phase 2a: Manually populated; Phase 2b: Auto-generated via geocoding
- `district_label` is human-friendly for UI display ("House District 23" vs "H-23")
- Indexed on `(chamber, district_label)` for fast delegation lookups by position

**Data population strategy**:
- Initial seed: OpenStates legislator list + manual contact scraping (one-time, ~150 reps)
- Updates: Contact info refreshed 1x per session or as needed
- Future Phase 2b: Add geocoding step to auto-map counties→districts if available

---

### Phase 2 API Endpoints

#### Endpoint 1: `/api/civic/bill-sponsors`
**Purpose**: Retrieve sponsors and cosponsors for a bill  
**Handler**: To be implemented in `worker/src/routes/billSponsors.mjs`

**Request**:
```
GET /api/civic/bill-sponsors?bill_id=ocd-bill%2Fus-wy-2025-HB0022&role=primary
```

**Query Parameters**:
| Parameter | Type | Default | Example | Description |
|-----------|------|---------|---------|-------------|
| `bill_id` | string | (required) | `ocd-bill/us-wy-2025-HB0022` | The civic_item_id of the bill |
| `chamber` | string | — | `house` | Optional: filter by "house" or "senate" |
| `role` | string | — | `primary` | Optional: filter by "primary", "cosponsor", or "committee" |

**Success Response (200 OK)**:
```json
{
  "bill_id": "ocd-bill/us-wy-2025-HB0022",
  "bill_number": "HB 22",
  "title": "Act relating to property tax relief",
  "sponsors": [
    {
      "id": 1,
      "name": "John Smith",
      "role": "primary",
      "chamber": "house",
      "district_label": "House District 23",
      "contact_email": "john.smith@wylegislature.gov",
      "contact_phone": "(307) 555-1234",
      "contact_website": "https://wylegislature.gov/legislators/john-smith"
    }
  ],
  "count": 1
}
```

**Empty Response (200 OK)** – No sponsors found:
```json
{
  "bill_id": "ocd-bill/us-wy-2025-HB0022",
  "bill_number": "HB 22",
  "sponsors": [],
  "count": 0,
  "note": "This bill has no recorded sponsors yet."
}
```

**Error Response (400 Bad Request)**:
```json
{
  "error": "Missing required parameter: bill_id",
  "status": 400
}
```

**Error Response (404 Not Found)**:
```json
{
  "error": "Bill not found",
  "bill_id": "ocd-bill/us-wy-2025-HB0022",
  "status": 404
}
```

**Implementation notes**:
- Query: `SELECT * FROM bill_sponsors WHERE civic_item_id = ? AND (role = ? OR ?) AND (chamber = ? OR ?)` (use NULL checks for optional params)
- Expect <10 sponsors per bill (no pagination needed)
- Add CORS header for public access
- No authentication required

---

#### Endpoint 2: `/api/civic/delegation/preview`
**Purpose**: Retrieve user's state delegation (reps) based on county  
**Handler**: To be implemented in `worker/src/routes/delegation.mjs`

**Request**:
```
GET /api/civic/delegation/preview?county=Natrona&state=WY
```

**Query Parameters**:
| Parameter | Type | Default | Example | Description |
|-----------|------|---------|---------|-------------|
| `county` | string | — | `Natrona` | Wyoming county name (case-insensitive); omit for no delegation |
| `state` | string | `WY` | `WY` | State code; currently only "WY" supported |

**Success Response (200 OK)** – County found with delegation:
```json
{
  "county": "Natrona",
  "state": "WY",
  "delegation": {
    "state_house": [
      {
        "id": 1,
        "name": "John Smith",
        "seat_id": "H-23",
        "district_label": "House District 23",
        "chamber": "house",
        "contact_email": "john.smith@wylegislature.gov",
        "contact_phone": "(307) 555-1234",
        "contact_website": "https://wylegislature.gov/legislators/john-smith"
      },
      {
        "id": 2,
        "name": "Robert Brown",
        "seat_id": "H-24",
        "district_label": "House District 24",
        "chamber": "house",
        "contact_email": "robert.brown@wylegislature.gov",
        "contact_phone": "(307) 555-4444",
        "contact_website": "https://wylegislature.gov/legislators/robert-brown"
      }
    ],
    "state_senate": [
      {
        "id": 12,
        "name": "Jane Doe",
        "seat_id": "S-10",
        "district_label": "Senate District 10",
        "chamber": "senate",
        "contact_email": "jane.doe@wylegislature.gov",
        "contact_phone": "(307) 555-5678",
        "contact_website": "https://wylegislature.gov/legislators/jane-doe"
      }
    ]
  },
  "message": "Delegation for Natrona County (2025 legislative session)",
  "matched_districts": ["H-23", "H-24", "S-10"]
}
```

**No County Provided (200 OK)**:
```json
{
  "county": null,
  "state": "WY",
  "delegation": {
    "state_house": [],
    "state_senate": []
  },
  "message": "Provide ?county=YourCounty to retrieve your delegation"
}
```

**Error Response (400 Bad Request)** – Invalid county:
```json
{
  "error": "County not found",
  "county": "InvalidCounty",
  "state": "WY",
  "status": 400
}
```

**Implementation notes**:
- Query: Parse `county_assignment` JSON array; match against provided county (case-insensitive)
- Return legislators grouped by chamber for intuitive "Your House rep" / "Your Senator" UI
- Expect 2-4 reps per county (1-2 house, 1-2 senate)
- Add CORS header for public access
- No authentication required
- Partial response OK (return available reps even if county assignment incomplete)

---

### Phase 2 Data Relationships

```
civic_items (Phase 1)
    ↓
    └─→ bill_sponsors (Phase 2)
            └─→ wy_legislators (Phase 2) – for normalization & delegation lookups
```

**Flow 1: Show sponsors on bill detail page**
1. User clicks bill on `/civic/pending/`
2. Page calls `GET /api/civic/bill-sponsors?bill_id={civic_item_id}`
3. Sponsor names, roles, districts, contact links displayed
4. (Future) "Contact sponsor" button opens email compose

**Flow 2: "Your delegation" card on /civic/watch**
1. User selects county (or auto-detected from preferences)
2. Page calls `GET /api/civic/delegation/preview?county=Natrona`
3. Delegation preview shows 2-4 reps with contact links
4. (Future) Links to bills sponsored by user's reps

---

### Phase 2 Integration Example (Frontend)

**Rendering sponsors on bill detail page**:
```javascript
// Load sponsors via API
const sponsorResp = await fetch(`/api/civic/bill-sponsors?bill_id=${bill.id}`);
const sponsorData = await sponsorResp.json();

if (sponsorData.sponsors.length > 0) {
  const sponsorList = sponsorData.sponsors
    .map(s => `
      <div class="sponsor">
        <strong>${s.name}</strong> (${s.role})
        <br/>
        <em>${s.district_label}</em>
        <br/>
        <a href="mailto:${s.contact_email}">Email</a>
        ${s.contact_phone ? `| <a href="tel:${s.contact_phone}">Call</a>` : ''}
        ${s.contact_website ? `| <a href="${s.contact_website}" target="_blank">Profile</a>` : ''}
      </div>
    `)
    .join('');
  document.getElementById('bill-sponsors').innerHTML = sponsorList;
} else {
  document.getElementById('bill-sponsors').innerHTML = '<em>No sponsors recorded.</em>';
}
```

**Rendering delegation preview on Civic Watch**:
```javascript
// Load delegation via API
const delegationResp = await fetch(`/api/civic/delegation/preview?county=${userCounty}`);
const delegationData = await delegationResp.json();

if (delegationData.delegation.state_house.length > 0) {
  const reps = delegationData.delegation.state_house.map(r =>
    `<a href="mailto:${r.contact_email}">${r.name}</a>`
  ).join(', ');
  document.getElementById('house-reps').innerText = `House: ${reps}`;
}

if (delegationData.delegation.state_senate.length > 0) {
  const senators = delegationData.delegation.state_senate.map(s =>
    `<a href="mailto:${s.contact_email}">${s.name}</a>`
  ).join(', ');
  document.getElementById('senators').innerText = `Senate: ${senators}`;
}
```

---

### Phase 2 Migration Checklist

- [ ] Create migration `0012_create_bill_sponsors.sql` and apply locally
- [ ] Create migration `0013_create_wy_legislators.sql` and apply locally
- [ ] Seed `wy_legislators` with Wyoming legislator list (~150 reps)
- [ ] Populate `wy_legislators.county_assignment` for each rep (manual or via lookup table)
- [ ] Seed `bill_sponsors` from current bills + OpenStates sponsor data
- [ ] Implement `handleBillSponsors()` handler in `worker/src/routes/billSponsors.mjs`
- [ ] Implement `handleDelegationPreview()` handler in `worker/src/routes/delegation.mjs`
- [ ] Add routes to `worker/src/index.mjs`:
  - `router.get("/api/civic/bill-sponsors", handleBillSponsors);`
  - `router.get("/api/civic/delegation/preview", handleDelegationPreview);`
- [ ] Write Jest tests for both handlers
- [ ] Test locally with sample data
- [ ] Deploy to Cloudflare Workers
- [ ] Document in team wiki/runbook

---

### Phase 2 Known Gaps & Future Extensions

1. **Geocoding (Phase 2b)**: Map user address → county → delegation automatically
   - Requires user location permission or manual county selection
   - Could integrate with user preferences system

2. **Legislator Voting History (Phase 2c)**: Show how user's reps voted on bills matching user's topics
   - Requires tracking legislator votes from OpenStates API
   - Link votes to `civic_items` and user's hot topics

3. **Multi-Session Support (Phase 2d)**: Track representation across sessions (2023, 2025, 2027, etc.)
   - Add `legislative_session` to `wy_legislators` as part of composite key
   - Query logic: "Which senators represented Natrona in 2025?"

4. **Social Media Contacts (Phase 2e)**: Add Twitter, Facebook, Instagram handles
   - Add columns: `twitter_handle`, `facebook_url`, `instagram_handle`
   - Enable "Contact on X" buttons

---

## Applied Migrations Checklist (Updated)

| Migration | File | Purpose | Status |
|-----------|------|---------|--------|
| 0006 | `0006_create_civic_items.sql` | Bills table | ✅ Applied |
| 0007 | `0007_create_user_ideas.sql` | Ideas table (future) | ✅ Applied |
| 0008 | `0008_create_votes.sql` | Voting table | ✅ Applied |
| 0009 | `0009_add_civic_item_ai_tags.sql` | Topic-bill matches | ✅ Applied |
| 0010 | `0010_add_reason_summary_to_civic_item_ai_tags.sql` | Reason explanations | ✅ Applied |
| 0011 | `0011_add_ai_summary_fields_to_civic_items.sql` | Bill summaries + caching | ✅ Applied |
| 0012 | `0012_create_bill_sponsors.sql` | Bill sponsors (Phase 2) | 🟡 Designed |
| 0013 | `0013_create_wy_legislators.sql` | Legislative directory (Phase 2) | 🟡 Designed |
