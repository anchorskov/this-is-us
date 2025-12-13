## Phase 2 API Endpoint Specifications

### Endpoint 1: `/api/civic/bill-sponsors`

**Purpose**: Retrieve sponsors and cosponsors for a specific bill with contact information.

**HTTP Method**: `GET`

**Query Parameters**:
```
bill_id (required, string)
  - The civic_item_id (OpenStates OCD ID) of the bill
  - Example: "ocd-bill/us-wy-2025-HB0022"
  
chamber (optional, string)
  - Filter by "house" | "senate"
  - If omitted, returns all sponsors regardless of chamber

role (optional, string)
  - Filter by "primary" | "cosponsor" | "committee"
  - If omitted, returns all roles
```

**Request Example**:
```
GET /api/civic/bill-sponsors?bill_id=ocd-bill%2Fus-wy-2025-HB0022&role=primary
```

**Success Response (200 OK)**:
```json
{
  "bill_id": "ocd-bill/us-wy-2025-HB0022",
  "bill_number": "HB 22",
  "title": "Sponsored Bill Example",
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
    },
    {
      "id": 2,
      "name": "Jane Doe",
      "role": "cosponsor",
      "chamber": "senate",
      "district_label": "Senate District 10",
      "contact_email": "jane.doe@wylegislature.gov",
      "contact_phone": "(307) 555-5678",
      "contact_website": "https://wylegislature.gov/legislators/jane-doe"
    }
  ],
  "count": 2
}
```

**Empty Response (200 OK)** – No sponsors found:
```json
{
  "bill_id": "ocd-bill/us-wy-2025-HB0022",
  "bill_number": "HB 22",
  "sponsors": [],
  "count": 0,
  "note": "This bill has no recorded sponsors in the system yet."
}
```

**Error Response (400 Bad Request)** – Missing bill_id:
```json
{
  "error": "Missing required query parameter: bill_id",
  "status": 400
}
```

**Error Response (404 Not Found)** – Bill doesn't exist:
```json
{
  "error": "Bill not found",
  "bill_id": "ocd-bill/us-wy-2025-HB0022",
  "status": 404
}
```

**Error Response (500 Internal Server Error)**:
```json
{
  "error": "Database error retrieving sponsors",
  "status": 500
}
```

---

### Endpoint 2: `/api/civic/delegation/preview`

**Purpose**: Retrieve a preview of the user's state delegation (House rep, Senate reps) based on county. Foundation for "Your delegation" card.

**HTTP Method**: `GET`

**Query Parameters**:
```
county (optional, string)
  - Wyoming county name (exact match, case-insensitive)
  - Example: "Natrona", "Laramie", "Albany"
  - If omitted, returns empty delegation (user will be prompted to select county)

state (optional, string)
  - Always "WY" for this endpoint; future extensibility
  - Default: "WY"
```

**Request Examples**:
```
GET /api/civic/delegation/preview?county=Natrona
GET /api/civic/delegation/preview?county=Natrona&state=WY
```

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
        "contact_email": "john.smith@wylegislature.gov",
        "contact_phone": "(307) 555-1234",
        "contact_website": "https://wylegislature.gov/legislators/john-smith"
      },
      {
        "id": 5,
        "name": "Robert Brown",
        "seat_id": "H-24",
        "district_label": "House District 24",
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
        "contact_email": "jane.doe@wylegislature.gov",
        "contact_phone": "(307) 555-5678",
        "contact_website": "https://wylegislature.gov/legislators/jane-doe"
      }
    ]
  },
  "message": "Delegation for Natrona County (2025 legislative session)"
}
```

**Partial Response (200 OK)** – County found but incomplete data:
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
        "contact_email": "john.smith@wylegislature.gov",
        "contact_phone": null,
        "contact_website": null
      }
    ],
    "state_senate": []
  },
  "message": "Partial delegation data (Senate reps not yet mapped for this county)"
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

**Error Response (400 Bad Request)** – Invalid county name:
```json
{
  "error": "County not found",
  "county": "InvalidCounty",
  "state": "WY",
  "status": 400
}
```

**Error Response (500 Internal Server Error)**:
```json
{
  "error": "Database error retrieving delegation",
  "status": 500
}
```

---

### Implementation Notes

#### Error Handling Pattern
All endpoints should:
- Return meaningful error messages (not just "error")
- Include relevant context (bill_id, county, etc.) in error responses
- Use appropriate HTTP status codes (400, 404, 500)
- Log errors to console for debugging

#### CORS & Authentication
- Both endpoints should be publicly accessible (CORS enabled)
- No authentication required for Phase 2 (delegation is public info)
- Future: Rate limiting may be added if called frequently

#### Performance Considerations
- Index on `civic_item_id` in `bill_sponsors` for fast bill→sponsors queries
- Index on `chamber, district_label` in `wy_legislators` for fast delegation lookups
- Consider caching delegation data (updated 1x per legislative session)

#### Future Extensions (Phase 2b+)
- Add geocoding to map user's address → county → delegation automatically
- Add "contact your rep" email compose button
- Track legislator social media handles for multi-channel contact
- Show legislator voting history on bills matching user's topics
