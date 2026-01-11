# Phase 2 Migration Files & Commands – Quick Reference

**Last Updated**: December 8, 2025

---

## Migration Files (Already Created)

### File 1: worker/migrations_wy/0012_create_bill_sponsors.sql

```sql
-- Migration: Create bill_sponsors table for Phase 2: Sponsors & Delegation
-- Tracks primary sponsors and cosponsors for bills with contact information
-- Enables "Who introduced this?" cards and future "Your delegation" lookups
--
-- Strategy:
-- - One row per sponsor-bill pair (bill can have multiple sponsors)
-- - sponsor_role: "primary" (first) or "cosponsor"
-- - contact_* fields are optional (may be NULL if legislator info incomplete)
-- - indices on (civic_item_id) for efficient bill→sponsors queries
-- - Created/updated timestamps for audit trail
--
-- Data flow:
-- - Populated manually or via OpenStates sync when it provides sponsor data
-- - Queried by bill detail page and future delegation preview cards

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

---

### File 2: worker/migrations_wy/0013_create_wy_legislators.sql

```sql
-- Migration: Create wy_legislators table for Phase 2: Delegation Lookup
-- Stores Wyoming state legislators with contact info, indexed by district/chamber
-- Enables "Your delegation" card that shows user's representatives based on county
--
-- Strategy:
-- - One row per legislator (unique legislator, not per bill)
-- - seat_id: Unique identifier combining chamber + district (e.g., "H-23", "S-10")
-- - district_label: Human-friendly label for display (e.g., "House District 23")
-- - county_assignment: NULL initially; filled in Phase 2a when geocoding/mapping logic added
-- - indices on (chamber, district_label) for efficient delegation lookups by position
-- - Created/updated for audit trail
--
-- Data flow:
-- - Seed from OpenStates legislator list + manual WY contact info (once per session)
-- - Queried by /api/civic/delegation/preview?county=... to find user's reps
-- - Future Phase 2b: Add geocoding to map counties→districts automatically
--
-- Example rows:
-- | id | seat_id | name | chamber | district_label | county_assignment | email | phone | website |
-- | 1  | "H-23"  | "John Smith" | "house" | "House District 23" | NULL | ... | ... | ... |
-- | 2  | "S-10"  | "Jane Doe"   | "senate" | "Senate District 10" | NULL | ... | ... | ... |

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

---

## Local Application Commands

### 1. Navigate to Worker Directory
```bash
cd /home/anchor/projects/this-is-us/worker
```

### 2. Apply All Pending Migrations to WY_DB
```bash
./scripts/wr d1 migrations apply WY_DB --local
```

**Expected Output** (success):
```
✓ Migrations applied to local database (WY_DB)
  ✓ 0012_create_bill_sponsors.sql
  ✓ 0013_create_wy_legislators.sql
```

### 3. Verify Tables Were Created
```bash
./scripts/wr d1 execute WY_DB --local --query "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('bill_sponsors', 'wy_legislators') ORDER BY name;"
```

**Expected Output**:
```json
{
  "success": true,
  "results": [
    {"name": "bill_sponsors"},
    {"name": "wy_legislators"}
  ]
}
```

### 4. Verify Indices Were Created (bill_sponsors)
```bash
./scripts/wr d1 execute WY_DB --local --query "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='bill_sponsors' ORDER BY name;"
```

**Expected Output**:
```json
{
  "success": true,
  "results": [
    {"name": "idx_bill_sponsors_civic_item"},
    {"name": "idx_bill_sponsors_district"},
    {"name": "idx_bill_sponsors_sponsor_name"}
  ]
}
```

### 5. Verify Indices Were Created (wy_legislators)
```bash
./scripts/wr d1 execute WY_DB --local --query "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='wy_legislators' ORDER BY name;"
```

**Expected Output**:
```json
{
  "success": true,
  "results": [
    {"name": "idx_wy_legislators_chamber_district"},
    {"name": "idx_wy_legislators_name"},
    {"name": "idx_wy_legislators_seat_id"}
  ]
}
```

### 6. Verify bill_sponsors Table Structure
```bash
./scripts/wr d1 execute WY_DB --local --query "PRAGMA table_info(bill_sponsors);"
```

**Expected Output** (11 columns):
```json
{
  "success": true,
  "results": [
    {"cid": 0, "name": "id", "type": "INTEGER", "notnull": 1, "dflt_value": null, "pk": 1},
    {"cid": 1, "name": "civic_item_id", "type": "TEXT", "notnull": 1, "dflt_value": null, "pk": 0},
    {"cid": 2, "name": "sponsor_name", "type": "TEXT", "notnull": 1, "dflt_value": null, "pk": 0},
    {"cid": 3, "name": "sponsor_role", "type": "TEXT", "notnull": 1, "dflt_value": null, "pk": 0},
    {"cid": 4, "name": "sponsor_district", "type": "TEXT", "notnull": 0, "dflt_value": null, "pk": 0},
    {"cid": 5, "name": "chamber", "type": "TEXT", "notnull": 0, "dflt_value": null, "pk": 0},
    {"cid": 6, "name": "contact_email", "type": "TEXT", "notnull": 0, "dflt_value": null, "pk": 0},
    {"cid": 7, "name": "contact_phone", "type": "TEXT", "notnull": 0, "dflt_value": null, "pk": 0},
    {"cid": 8, "name": "contact_website", "type": "TEXT", "notnull": 0, "dflt_value": null, "pk": 0},
    {"cid": 9, "name": "created_at", "type": "TEXT", "notnull": 1, "dflt_value": null, "pk": 0},
    {"cid": 10, "name": "updated_at", "type": "TEXT", "notnull": 1, "dflt_value": null, "pk": 0}
  ]
}
```

### 7. Verify wy_legislators Table Structure
```bash
./scripts/wr d1 execute WY_DB --local --query "PRAGMA table_info(wy_legislators);"
```

**Expected Output** (13 columns):
```json
{
  "success": true,
  "results": [
    {"cid": 0, "name": "id", "type": "INTEGER", "notnull": 1, "dflt_value": null, "pk": 1},
    {"cid": 1, "name": "seat_id", "type": "TEXT", "notnull": 1, "dflt_value": null, "pk": 0},
    {"cid": 2, "name": "name", "type": "TEXT", "notnull": 1, "dflt_value": null, "pk": 0},
    {"cid": 3, "name": "chamber", "type": "TEXT", "notnull": 1, "dflt_value": null, "pk": 0},
    {"cid": 4, "name": "district_label", "type": "TEXT", "notnull": 1, "dflt_value": null, "pk": 0},
    {"cid": 5, "name": "district_number", "type": "TEXT", "notnull": 0, "dflt_value": null, "pk": 0},
    {"cid": 6, "name": "county_assignment", "type": "TEXT", "notnull": 0, "dflt_value": null, "pk": 0},
    {"cid": 7, "name": "contact_email", "type": "TEXT", "notnull": 0, "dflt_value": null, "pk": 0},
    {"cid": 8, "name": "contact_phone", "type": "TEXT", "notnull": 0, "dflt_value": null, "pk": 0},
    {"cid": 9, "name": "website_url", "type": "TEXT", "notnull": 0, "dflt_value": null, "pk": 0},
    {"cid": 10, "name": "bio", "type": "TEXT", "notnull": 0, "dflt_value": null, "pk": 0},
    {"cid": 11, "name": "created_at", "type": "TEXT", "notnull": 1, "dflt_value": null, "pk": 0},
    {"cid": 12, "name": "updated_at", "type": "TEXT", "notnull": 1, "dflt_value": null, "pk": 0},
    {"cid": 13, "name": "legislative_session", "type": "TEXT", "notnull": 0, "dflt_value": null, "pk": 0}
  ]
}
```

### 8. Quick Health Check (All-in-One)
```bash
cd /home/anchor/projects/this-is-us/worker && \
./scripts/wr d1 migrations apply WY_DB --local && \
./scripts/wr d1 execute WY_DB --local --query "SELECT 'bill_sponsors' as table_name, COUNT(*) as column_count FROM pragma_table_info('bill_sponsors') UNION ALL SELECT 'wy_legislators', COUNT(*) FROM pragma_table_info('wy_legislators');"
```

---

## Troubleshooting

### Issue: "Migrations already applied"
**Cause**: Migrations were already applied in a previous session.  
**Solution**: This is normal. Run `./scripts/wr d1 migrations list WY_DB --local` to verify:
```bash
./scripts/wr d1 migrations list WY_DB --local
```

### Issue: "Foreign key constraint error on bill_sponsors"
**Cause**: civic_items table doesn't exist or has no data.  
**Solution**: Ensure Phase 1 migrations are applied first:
```bash
./scripts/wr d1 migrations apply WY_DB --local
```

### Issue: "Duplicate entry for key seat_id in wy_legislators"
**Cause**: Trying to insert duplicate seat_id values.  
**Solution**: Check for duplicate seat_id values in seed data (must be UNIQUE).

### Issue: Indices not showing up
**Cause**: CREATE INDEX statement failed silently.  
**Solution**: Check migration file syntax and re-apply:
```bash
./scripts/wr d1 migrations rollback WY_DB --local
./scripts/wr d1 migrations apply WY_DB --local
```

---

## Next Steps After Application

1. ✅ **Verify migrations applied** – See commands above
2. 🔄 **Seed data** – See PHASE_2_MIGRATION_SETUP.md for seed guidance
3. 🎯 **Implement API handlers** – See PHASE_2_IMPLEMENTATION_SUMMARY.md for specs
4. 🧪 **Test locally** – Start dev server and test endpoints
5. 📤 **Deploy** – Push to Cloudflare Workers production

---

**Created**: December 8, 2025  
**Purpose**: Quick reference for applying Phase 2 migrations locally  
**Status**: Ready to Use
