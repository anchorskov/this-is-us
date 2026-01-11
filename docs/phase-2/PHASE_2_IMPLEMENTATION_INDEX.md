# Phase 2 Implementation Index – Complete Reference

**Status**: ✅ INFRASTRUCTURE COMPLETE  
**Date**: December 8, 2025  
**Next Phase**: API Handler Implementation (Codex)

---

## 🎯 Quick Navigation

### For Jimmy (Local Setup & Verification)
→ **Start here**: `documentation/PHASE_2_MIGRATION_COMMANDS.md`
- Copy-paste commands to apply migrations locally
- Verification queries to confirm success
- Troubleshooting section

### For Codex (API Implementation)
→ **Start here**: `documentation/SNAPSHOT_120625_COMPREHENSIVE.md` (lines 865-1120)
- Complete schema and API specifications
- Request/response examples with edge cases
- Implementation notes and error handling

### For Project Managers
→ **Overview**: `documentation/PHASE_2_IMPLEMENTATION_SUMMARY.md`
- Timeline and deliverables
- Next steps and success criteria
- Quality checklist

---

## 📦 Complete Deliverables

### 1. Database Migrations

| File | Purpose | Status | Location |
|------|---------|--------|----------|
| `0012_create_bill_sponsors.sql` | Track bill sponsors with contact info | ✅ Created | `worker/migrations_wy/` |
| `0013_create_wy_legislators.sql` | Legislative directory for delegation | ✅ Created | `worker/migrations_wy/` |

**Total Schema**: 24 columns across 2 tables, 6 indices, 1 foreign key constraint

### 2. Updated Documentation

| File | Purpose | Status | Location |
|------|---------|--------|----------|
| `SNAPSHOT_120625_COMPREHENSIVE.md` | Single source of truth (updated Phase 2 sections) | ✅ Updated | `documentation/` |
| `PHASE_2_MIGRATION_SETUP.md` | Detailed local setup and data seeding guide | ✅ Created | `documentation/` |
| `PHASE_2_MIGRATION_COMMANDS.md` | Quick reference for migration commands | ✅ Created | `documentation/` |
| `PHASE_2_IMPLEMENTATION_SUMMARY.md` | Handoff guide for API implementation | ✅ Created | `documentation/` |
| `PHASE_2_IMPLEMENTATION_INDEX.md` | This file – complete reference | ✅ Created | `documentation/` |

### 3. API Specifications

| Endpoint | Purpose | Status | Spec Location |
|----------|---------|--------|---------------|
| `GET /api/civic/bill-sponsors?bill_id=...` | Retrieve bill sponsors | ✅ Specified | SNAPSHOT lines 970-1010 |
| `GET /api/civic/delegation/preview?county=...` | Retrieve user's delegation | ✅ Specified | SNAPSHOT lines 1015-1090 |

**Both endpoints**: CORS-enabled, no authentication required, JSON responses

---

## 🚀 Implementation Roadmap

### Phase 2a: Bill Sponsors Endpoint (Handler Implementation)

**Checklist**:
- [ ] Create `worker/src/routes/billSponsors.mjs`
- [ ] Implement `handleBillSponsors(request, env)` function
- [ ] Parse query parameters: `bill_id` (required), `role` (optional), `chamber` (optional)
- [ ] Query WY_DB `bill_sponsors` table
- [ ] Return JSON response: `{bill_id, bill_number, title, sponsors[], count}`
- [ ] Add error handling: 400 for missing bill_id, 500 for DB errors
- [ ] Add CORS headers via `withCORS()`
- [ ] Write Jest tests in `__tests__/bill-sponsors.test.js`

**Estimated Effort**: 3-4 hours

**Reference Spec**: SNAPSHOT_120625_COMPREHENSIVE.md lines 970-1010

---

### Phase 2b: Delegation Preview Endpoint (Handler Implementation)

**Checklist**:
- [ ] Create `worker/src/routes/delegation.mjs`
- [ ] Implement `handleDelegationPreview(request, env)` function
- [ ] Parse query parameters: `county` (optional), `state` (default "WY")
- [ ] Query WY_DB `wy_legislators` table
- [ ] Parse `county_assignment` JSON array
- [ ] Group results by chamber: `{state_house: [], state_senate: []}`
- [ ] Return JSON response with message and matched_districts
- [ ] Add error handling: 400 for invalid county, graceful empty for no county
- [ ] Add CORS headers via `withCORS()`
- [ ] Write Jest tests in `__tests__/delegation.test.js`

**Estimated Effort**: 3-4 hours

**Reference Spec**: SNAPSHOT_120625_COMPREHENSIVE.md lines 1015-1090

---

### Phase 2c: Route Registration (Worker Integration)

**Checklist**:
- [ ] Update `worker/src/index.mjs`
- [ ] Import both handlers at top:
  - `import { handleBillSponsors } from "./routes/billSponsors.mjs"`
  - `import { handleDelegationPreview } from "./routes/delegation.mjs"`
- [ ] Register routes with router:
  - `router.get("/api/civic/bill-sponsors", handleBillSponsors)`
  - `router.get("/api/civic/delegation/preview", handleDelegationPreview)`
- [ ] Test local dev server
- [ ] Deploy to Cloudflare Workers

**Estimated Effort**: 1-2 hours

---

## 📋 Schema Quick Reference

### bill_sponsors Table (11 columns)

```
id               | INTEGER PRIMARY KEY AUTOINCREMENT
civic_item_id    | TEXT NOT NULL (FK → civic_items.id, ON DELETE CASCADE)
sponsor_name     | TEXT NOT NULL
sponsor_role     | TEXT NOT NULL ("primary", "cosponsor", "committee")
sponsor_district | TEXT (e.g., "HD-23", "SF-10", NULL for at-large)
chamber          | TEXT ("house", "senate")
contact_email    | TEXT (optional)
contact_phone    | TEXT (optional)
contact_website  | TEXT (optional)
created_at       | TEXT NOT NULL (ISO 8601)
updated_at       | TEXT NOT NULL (ISO 8601)

Indices: civic_item_id, sponsor_name, sponsor_district
```

### wy_legislators Table (13 columns)

```
id                   | INTEGER PRIMARY KEY AUTOINCREMENT
seat_id              | TEXT NOT NULL UNIQUE (e.g., "H-23", "S-10")
name                 | TEXT NOT NULL
chamber              | TEXT NOT NULL ("house", "senate")
district_label       | TEXT NOT NULL (e.g., "House District 23")
district_number      | TEXT (e.g., "23", "10")
county_assignment    | TEXT (JSON array: ["Natrona", "Johnson"])
contact_email        | TEXT
contact_phone        | TEXT
website_url          | TEXT
bio                  | TEXT (optional)
created_at           | TEXT NOT NULL (ISO 8601)
updated_at           | TEXT NOT NULL (ISO 8601)
legislative_session  | TEXT (e.g., "2025")

Indices: (chamber, district_label), seat_id, name
```

---

## 🔧 Local Setup (for Jimmy)

### 1. Apply Migrations

```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 migrations apply WY_DB --local
```

### 2. Verify Tables Created

```bash
./scripts/wr d1 execute WY_DB --local --query \
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('bill_sponsors', 'wy_legislators');"
```

**Expected Output**: `[{name: "bill_sponsors"}, {name: "wy_legislators"}]`

### 3. Verify Indices

```bash
./scripts/wr d1 execute WY_DB --local --query \
  "SELECT COUNT(*) as total FROM sqlite_master WHERE type='index' AND tbl_name IN ('bill_sponsors', 'wy_legislators');"
```

**Expected Output**: `[{total: 6}]`

### 4. Quick Health Check

```bash
cd /home/anchor/projects/this-is-us/worker && \
./scripts/wr d1 migrations apply WY_DB --local && \
./scripts/wr d1 execute WY_DB --local --query \
  "SELECT 'bill_sponsors' as table_name, (SELECT COUNT(*) FROM pragma_table_info('bill_sponsors')) as columns UNION ALL SELECT 'wy_legislators', (SELECT COUNT(*) FROM pragma_table_info('wy_legislators'))"
```

**Expected Output**: 
- bill_sponsors: 11 columns
- wy_legislators: 13 columns

---

## 📊 API Response Examples

### Bill Sponsors Success Response
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

### Delegation Preview Success Response
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
  "matched_districts": ["H-23", "S-10"]
}
```

### Delegation No County Response
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

---

## 🧪 Testing Strategy

### Unit Tests (Per Handler)

**bill-sponsors.test.js**:
```javascript
describe('handleBillSponsors', () => {
  test('returns sponsors for valid bill_id', async () => {
    const response = await handleBillSponsors(
      new Request('http://localhost/api/civic/bill-sponsors?bill_id=ocd-bill/us-wy-2025-HB0001'),
      mockEnv
    );
    expect(response.status).toBe(200);
    expect(response.json.sponsors).toBeInstanceOf(Array);
  });

  test('returns 400 for missing bill_id', async () => {
    const response = await handleBillSponsors(
      new Request('http://localhost/api/civic/bill-sponsors'),
      mockEnv
    );
    expect(response.status).toBe(400);
  });

  test('returns empty array for bill with no sponsors', async () => {
    // Test with bill_id that exists but has no sponsors
  });
});
```

**delegation.test.js**:
```javascript
describe('handleDelegationPreview', () => {
  test('returns delegation for valid county', async () => {
    const response = await handleDelegationPreview(
      new Request('http://localhost/api/civic/delegation/preview?county=Natrona'),
      mockEnv
    );
    expect(response.status).toBe(200);
    expect(response.json.delegation.state_house).toBeInstanceOf(Array);
  });

  test('returns empty delegation for no county parameter', async () => {
    const response = await handleDelegationPreview(
      new Request('http://localhost/api/civic/delegation/preview'),
      mockEnv
    );
    expect(response.status).toBe(200);
    expect(response.json.delegation.state_house.length).toBe(0);
  });

  test('returns 400 for invalid county', async () => {
    const response = await handleDelegationPreview(
      new Request('http://localhost/api/civic/delegation/preview?county=InvalidCounty'),
      mockEnv
    );
    expect(response.status).toBe(400);
  });
});
```

### Integration Tests
- Test both endpoints together on `/civic/watch/` page
- Verify sponsor data displays alongside bills
- Verify delegation card shows for selected county

---

## 📚 Documentation Files

### For Operations (Jimmy)
1. **PHASE_2_MIGRATION_COMMANDS.md** – Quick copy-paste commands
2. **PHASE_2_MIGRATION_SETUP.md** – Detailed setup guide with troubleshooting

### For Development (Codex)
1. **SNAPSHOT_120625_COMPREHENSIVE.md** – Full schema and API spec (lines 865-1120)
2. **PHASE_2_IMPLEMENTATION_SUMMARY.md** – Implementation roadmap and testing strategy

### For Project (Everyone)
1. **PHASE_2_IMPLEMENTATION_INDEX.md** – This file (complete reference)

---

## ✅ Success Criteria

### Phase 2 Infrastructure (This Pass) ✅ COMPLETE
- [x] Migrations created and documented
- [x] Schemas validated against proposal
- [x] API specifications finalized
- [x] Local setup guide comprehensive
- [x] No breaking changes to Phase 1

### Phase 2 API Implementation (Next)
- [ ] Both handlers implemented
- [ ] All tests passing
- [ ] No console errors
- [ ] CORS headers present
- [ ] Pagination tested (if needed)

### Phase 2 Data & UI (Concurrent)
- [ ] wy_legislators seeded with ~150 reps
- [ ] bill_sponsors seeded for current bills
- [ ] Sponsors display on bill cards
- [ ] Delegation card on Civic Watch
- [ ] Contact links functional

---

## 🚦 Status Summary

| Component | Status | Confidence |
|-----------|--------|-----------|
| Database migrations | ✅ Complete | ⭐⭐⭐⭐⭐ |
| API specifications | ✅ Complete | ⭐⭐⭐⭐⭐ |
| Documentation | ✅ Complete | ⭐⭐⭐⭐⭐ |
| Local setup guide | ✅ Complete | ⭐⭐⭐⭐⭐ |
| Handoff quality | ✅ Complete | ⭐⭐⭐⭐⭐ |

**Overall Status**: 🟢 READY FOR API IMPLEMENTATION

---

## 🔗 References

- **Project**: This Is Us – Civic Watch
- **Phase**: Phase 2 (Sponsor & Delegation Infrastructure)
- **Database**: WY_DB (Cloudflare D1)
- **Framework**: Cloudflare Workers + Wrangler
- **Testing**: Jest

---

**Document**: PHASE_2_IMPLEMENTATION_INDEX.md  
**Created**: December 8, 2025  
**Status**: ✅ Complete  
**Version**: 1.0
