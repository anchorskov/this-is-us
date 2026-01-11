# Phase 2: Sponsor & Delegation Infrastructure Setup

**Date**: December 8, 2025  
**Status**: ✅ Migrations Created & Ready for Local Application  
**Target**: Apply Phase 2 table migrations locally, then implement API handlers

---

## Overview

Phase 2 adds two new tables to the **WY_DB** database to support bill sponsors and state delegation lookup:

1. **bill_sponsors** (Migration 0012) – Tracks who introduced bills
2. **wy_legislators** (Migration 0013) – Legislative directory for delegation preview

Both migrations are **created and ready**. The next step is to apply them locally, seed data, and implement the API handlers.

---

## Migration Files

### 1. Migration 0012: bill_sponsors
**Location**: `worker/migrations_wy/0012_create_bill_sponsors.sql`

**Purpose**: Track bill sponsors and cosponsors with contact information

**Schema** (11 columns):
- `id` – Auto-increment primary key
- `civic_item_id` – FK to civic_items(id), ON DELETE CASCADE
- `sponsor_name` – Legislator name ("John Smith")
- `sponsor_role` – "primary" | "cosponsor" | "committee"
- `sponsor_district` – "HD-23" | "SF-10" | NULL
- `chamber` – "house" | "senate" (denormalized for speed)
- `contact_email` – legislator@wylegislature.gov
- `contact_phone` – (307) 555-1234
- `contact_website` – https://wylegislature.gov/...
- `created_at` – ISO 8601 timestamp
- `updated_at` – ISO 8601 timestamp

**Indices** (3):
- `idx_bill_sponsors_civic_item` – ON (civic_item_id) – primary lookup
- `idx_bill_sponsors_sponsor_name` – ON (sponsor_name) – search by legislator
- `idx_bill_sponsors_district` – ON (sponsor_district) – filter by district

---

### 2. Migration 0013: wy_legislators
**Location**: `worker/migrations_wy/0013_create_wy_legislators.sql`

**Purpose**: Store Wyoming state legislators for delegation preview and future reference

**Schema** (13 columns):
- `id` – Auto-increment primary key
- `seat_id` – Unique identifier ("H-23", "S-10") UNIQUE
- `name` – Legislator name ("John Smith")
- `chamber` – "house" | "senate"
- `district_label` – Display-friendly ("House District 23")
- `district_number` – Numeric ("23" or "10")
- `county_assignment` – JSON array of counties (["Natrona", "Johnson"]) – Phase 2b feature
- `contact_email` – legislator@wylegislature.gov
- `contact_phone` – (307) 555-1234
- `website_url` – https://wylegislature.gov/...
- `bio` – Short bio / party affiliation (optional)
- `created_at` – ISO 8601 timestamp
- `updated_at` – ISO 8601 timestamp
- `legislative_session` – "2025" (for multi-year support)

**Indices** (3):
- `idx_wy_legislators_chamber_district` – ON (chamber, district_label) – primary delegation lookup
- `idx_wy_legislators_seat_id` – ON (seat_id) – unique identifier lookup
- `idx_wy_legislators_name` – ON (name) – search by legislator

---

## Local Setup Commands

### 1. Navigate to Worker Directory
```bash
cd /home/anchor/projects/this-is-us/worker
```

### 2. Apply Migrations to Local WY_DB
```bash
# Apply all pending migrations to WY_DB (includes 0012 and 0013)
./scripts/wr d1 migrations apply WY_DB --local
```

**Expected Output**:
```
✓ Migrations applied to local database (WY_DB)
  - 0012_create_bill_sponsors.sql
  - 0013_create_wy_legislators.sql
```

### 3. Verify Migrations Were Applied
```bash
# Query to verify bill_sponsors table exists
./scripts/wr d1 execute WY_DB --local --query "SELECT name FROM sqlite_master WHERE type='table' AND name='bill_sponsors';"

# Expected output:
# { "results": [{"name": "bill_sponsors"}] }

# Query to verify wy_legislators table exists
./scripts/wr d1 execute WY_DB --local --query "SELECT name FROM sqlite_master WHERE type='table' AND name='wy_legislators';"

# Expected output:
# { "results": [{"name": "wy_legislators"}] }
```

### 4. Check Index Creation
```bash
# Verify bill_sponsors indices
./scripts/wr d1 execute WY_DB --local --query "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='bill_sponsors';"

# Expected output:
# { "results": [
#   {"name": "idx_bill_sponsors_civic_item"},
#   {"name": "idx_bill_sponsors_sponsor_name"},
#   {"name": "idx_bill_sponsors_district"}
# ]}

# Verify wy_legislators indices
./scripts/wr d1 execute WY_DB --local --query "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='wy_legislators';"

# Expected output:
# { "results": [
#   {"name": "idx_wy_legislators_chamber_district"},
#   {"name": "idx_wy_legislators_seat_id"},
#   {"name": "idx_wy_legislators_name"}
# ]}
```

---

## Data Seeding (Next Steps)

After migrations are applied, the following data work is needed:

### 1. Seed wy_legislators (~150 Wyoming state legislators)
**Source**: OpenStates API + manual WY contact info  
**Effort**: 1-2 hours (one-time)  
**Script location**: `worker/seeds/seed_wy_legislators.sql` or JS script  

**Example seed**:
```sql
INSERT INTO wy_legislators (seat_id, name, chamber, district_label, district_number, contact_email, contact_phone, website_url, created_at, updated_at, legislative_session)
VALUES
  ('H-1', 'John Smith', 'house', 'House District 1', '1', 'john.smith@wylegislature.gov', '307-555-1234', 'https://wylegislature.gov/...', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z', '2025'),
  ('H-2', 'Jane Doe', 'house', 'House District 2', '2', 'jane.doe@wylegislature.gov', '307-555-5678', 'https://wylegislature.gov/...', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z', '2025'),
  ...
  ('S-1', 'Alice Johnson', 'senate', 'Senate District 1', '1', 'alice.johnson@wylegislature.gov', '307-555-9999', 'https://wylegislature.gov/...', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z', '2025'),
  ...
;
```

**Validation**: 
- Total rows: ~62 House + ~30 Senate + ~2 At-Large = ~94 reps
- All required fields present
- Unique seat_id values

### 2. Seed bill_sponsors (from current bills)
**Source**: Current civic_items in WY_DB + OpenStates sponsor data  
**Effort**: 2-3 hours (depends on OpenStates API integration)  
**Script location**: `worker/seeds/seed_bill_sponsors.js`

**Example seed**:
```sql
INSERT INTO bill_sponsors (civic_item_id, sponsor_name, sponsor_role, sponsor_district, chamber, contact_email, contact_phone, contact_website, created_at, updated_at)
VALUES
  ('ocd-bill/us-wy-2025-HB0001', 'John Smith', 'primary', 'HD-23', 'house', 'john.smith@wylegislature.gov', '307-555-1234', 'https://wylegislature.gov/...', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'),
  ('ocd-bill/us-wy-2025-HB0001', 'Jane Doe', 'cosponsor', 'SD-10', 'senate', 'jane.doe@wylegislature.gov', '307-555-5678', 'https://wylegislature.gov/...', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'),
  ...
;
```

**Validation**:
- All civic_item_id values exist in civic_items table
- sponsor_role in ("primary", "cosponsor", "committee")
- chamber matches sponsor_district (HD → house, SF → senate)

---

## Phase 2 Implementation Roadmap

After migrations are applied locally:

### ✅ Complete (Migrations)
- [x] Create `0012_create_bill_sponsors.sql`
- [x] Create `0013_create_wy_legislators.sql`

### 🔄 In Progress (API Handlers)
- [ ] Implement `handleBillSponsors()` in `worker/src/routes/billSponsors.mjs`
- [ ] Implement `handleDelegationPreview()` in `worker/src/routes/delegation.mjs`
- [ ] Register routes in `worker/src/index.mjs`
- [ ] Write Jest tests for both handlers

### 📋 Ready for Implementation (Specs)
- API spec for `/api/civic/bill-sponsors?bill_id=...` – See SNAPSHOT_120625_COMPREHENSIVE.md
- API spec for `/api/civic/delegation/preview?county=...` – See SNAPSHOT_120625_COMPREHENSIVE.md

---

## Quick Checklist for Jimmy (Local Setup)

```bash
# 1. Navigate to worker directory
cd /home/anchor/projects/this-is-us/worker

# 2. Apply Phase 2 migrations
./scripts/wr d1 migrations apply WY_DB --local

# 3. Verify bill_sponsors table
./scripts/wr d1 execute WY_DB --local --query "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table' AND name IN ('bill_sponsors', 'wy_legislators');"

# 4. Check indices
./scripts/wr d1 execute WY_DB --local --query "SELECT name FROM sqlite_master WHERE type='index' ORDER BY tbl_name;"

# 5. Ready for Codex to start API implementation
echo "✅ Phase 2 tables created and ready for API handlers!"
```

---

## API Implementation Ready

Once migrations are applied, Codex can implement the API handlers using the specifications in:
- **SNAPSHOT_120625_COMPREHENSIVE.md** – Lines 960-1090+ (bill-sponsors and delegation/preview endpoints)

Both handlers follow the same pattern as existing endpoints:
1. Parse query parameters
2. Query WY_DB
3. Return JSON response with CORS headers

---

## Contact & Troubleshooting

**Issue**: Migration fails with "FOREIGN KEY constraint failed"
- **Solution**: Ensure `civic_items` table exists and has data before seeding bill_sponsors

**Issue**: Indices not created
- **Solution**: Verify all CREATE INDEX statements executed; check ./scripts/wr.toml for migrations_dir config

**Issue**: Duplicate seat_id in wy_legislators
- **Solution**: UNIQUE constraint on seat_id prevents duplicates; verify seed script before running

---

**Created**: December 8, 2025  
**Phase**: Phase 2 – Sponsor & Delegation Infrastructure  
**Status**: ✅ Ready for Local Application
