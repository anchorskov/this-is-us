# Database Snapshot – December 14, 2025 (UPDATED Dec 15)

## Overview
This document captures the current state of the This Is Us project's D1 databases, including schemas, tables, indexes, and access patterns as of December 14, 2025.

**🚨 CRITICAL UPDATE (December 15, 2025):**
- **LOCAL D1 DATABASE STATE IS STALE** – Only migrations 0001-0006 applied locally (19 missing migrations)
- **REMOTE/PRODUCTION STATE IS CURRENT** – All 25 migrations applied on Cloudflare D1
- **NEW TABLES ON REMOTE:** podcast_uploads, townhall_posts, townhall_replies, civic_items (in WY_DB), bill_sponsors, verified_users, civic_item_verification, civic_item_sources
- **MIGRATION GAP:** Migrations 0007-0025 exist on disk but NOT applied locally due to ./scripts/wr initialization timing
- **BALLOT_DB STATUS:** Empty/unused (0 bytes, no migrations)

---

## D1 Databases Configuration

The project uses **3 D1 databases** across local development, preview, and production environments:

### 1. EVENTS_DB (Primary Application DB)
**Bindings & IDs:**
- Local: `events_db_local` (ID: `6c3fffd4-e6dc-47b8-b541-3857c2882e0c`)
- Preview: `events_db_preview` (ID: `1624450c-f228-4802-8a76-9c65f29295fa`)
- Production: `events_db` (ID: `b5814930-2779-4bfb-8052-24ee419e09fd`)

**LOCAL Current State (Dec 15):** 
- **Tables:** 9 (events, hot_topics, hot_topic_civic_items, topic_index, user_topic_prefs, topic_requests, _cf_METADATA, d1_migrations, sqlite_sequence)
- **Size:** 64 KB
- **Migrations Applied:** 6 only (0001-0006) ⚠️ STALE
- **Missing Migrations:** 0007-0025 (19 migrations not applied to local) ⚠️
- **Missing Tables Locally:** podcast_uploads, townhall_posts, townhall_replies, civic_items, civic_item_ai_tags, bill_sponsors, civic_item_verification
- **Data:** hot_topics (12 rows), hot_topic_civic_items (0 rows), events (0 rows)

**REMOTE/PRODUCTION Current State (Dec 14):**
- **Tables:** 14+ (hot_topics infrastructure + podcast uploads + townhall system)
- **Size:** ~100 KB
- **Migrations Applied:** 0001-0025 (all migrations)
- **New Additions:** podcast_uploads table (0021) + summary field (0022), townhall_posts (0016), townhall_replies (0018), civic item AI tags (0024)
- **Data:** JR Riggins podcast (3 parts), 12 hot topics seeded

### 2. WY_DB (Wyoming Civic Data)
**Bindings & IDs:**
- Local: `wy` (ID: `4b4227f1-bf30-4fcf-8a08-6967b536a5ab`)
- Preview: `wy_preview` (ID: `de78cb41-176d-40e8-bd3b-e053e347ac3f`)
- Production: `wy` (ID: `4b4227f1-bf30-4fcf-8a08-6967b536a5ab`)

**LOCAL Current State (Dec 15):**
- **Tables:** 13 (voters, voters_addr_norm, voters_norm, voters_raw, voter_phones, wy_city_county, streets_index, streets_index_old, tmp_voter_street, v_best_phone_old, _cf_METADATA, d1_migrations, sqlite_sequence)
- **Size:** 96 KB
- **Migrations Applied:** 5 only (0001-0005) ⚠️ STALE
- **Missing Migrations:** 0006-0025 (20 migrations not applied) ⚠️
- **Missing Tables Locally:** civic_items, votes, user_ideas, bill_sponsors, wy_legislators, civic_item_ai_tags, verified_users, civic_item_sources, civic_item_verification
- **Data:** voters (0 rows) – empty test database

**REMOTE/PRODUCTION Current State (Dec 14):**
- **Tables:** 16+ (core voter data, civic items, bill sponsors, legislators, verification system)
- **Size:** ~111 MB | **Voter Records:** 274,656 normalized addresses
- **Migrations Applied:** 0001-0025 (all migrations)
- **Tables:** voters, voters_addr_norm, civic_items, votes, streets_index, bill_sponsors, wy_legislators, civic_item_ai_tags, verified_users, civic_item_sources, civic_item_verification, etc.

### 3. BALLOT_DB (Unused)
**Bindings & IDs:**
- ID: `9c4b0c27-eb33-46e6-a477-fb49d4c81474`
- Status: ⚠️ EMPTY / NEVER INITIALIZED
- Size: 0 bytes
- Tables: None
- Migrations: None applied

---

## ⚠️ CRITICAL: LOCAL vs REMOTE DATABASE MISMATCH

### The Problem
**Local D1 databases are STALE and do NOT match production/remote state.**

- **EVENTS_DB Local:** 6 migrations applied (0001-0006), 9 tables
- **EVENTS_DB Remote:** 25 migrations applied (0001-0025), 14+ tables ✅ CURRENT
- **WY_DB Local:** 5 migrations applied (0001-0005), 13 tables
- **WY_DB Remote:** 25 migrations applied (0001-0025), 16+ tables ✅ CURRENT

### Why This Happened
1. Local databases were initialized with early migration set (Jul-Dec 2024)
2. 19 newer migrations (0007-0025) were created on Dec 4-14, 2025
3. Wrangler does NOT auto-apply new migrations to existing local databases
4. New migrations exist on disk but have never been applied locally
5. Migrations WERE applied remotely via Cloudflare D1 console

### What's Missing Locally?
**EVENTS_DB missing tables:**
- `podcast_uploads` (created Dec 14 via migration 0021, 0022)
- `townhall_posts` (migration 0016)
- `townhall_replies` (migration 0018)
- Additional civic matching fields

**WY_DB missing tables:**
- `civic_items` (migration 0006)
- `user_ideas` (migration 0007)
- `votes` (migration 0008)
- `bill_sponsors` (migration 0012)
- `wy_legislators` (migration 0013)
- `civic_item_ai_tags` (migration 0009)
- `civic_item_sources` (migration 0015)
- `verified_users` (migration 0018)
- `civic_item_verification` (migration 0019)

### Severity: MEDIUM (Dev Environment)
- Development features depending on missing tables will fail
- Remote/production is fine (all tables present)
- Fix is simple: Reset local DB or manually apply migrations

### Recovery: Reset Local DB (Recommended)
```bash
cd worker
# Delete stale local D1 state
rm -rf ../scripts/wr/state/v3/d1/miniflare-D1DatabaseObject/

# Wrangler will re-initialize and apply all migrations
./scripts/wr d1 execute EVENTS_DB --local --command "SELECT COUNT(*) FROM hot_topics;"
./scripts/wr d1 execute WY_DB --local --command "SELECT COUNT(*) FROM voters;"
```

---

## EVENTS_DB Schema (Detail - REMOTE/PRODUCTION STATE)

### podcast_uploads Table (NEW - Dec 14, 2025)
**Purpose:** Track podcast episode file uploads, metadata, deduplication, and summaries for display and audit trails

**Schema:**
```sql
CREATE TABLE podcast_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_slug TEXT NOT NULL,
  episode_date TEXT NOT NULL,
  part_number INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  summary TEXT,
  UNIQUE(guest_slug, episode_date, part_number),
  UNIQUE(r2_key),
  UNIQUE(sha256)
)
```

**Field Descriptions:**
- `id` - Auto-incremented primary key
- `guest_slug` - URL-friendly guest name (e.g., "jr-riggins")
- `episode_date` - Date in YYYY-MM-DD format (e.g., "2025-12-14")
- `part_number` - Sequence number within episode (1, 2, 3...)
- `r2_key` - Full R2 bucket path (e.g., "podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3")
- `sha256` - SHA256 hash of file for deduplication and integrity
- `bytes` - File size in bytes for storage tracking
- `uploaded_at` - Timestamp when file was uploaded (auto-populated)
- `summary` - Episode description, topics, or chapter notes (optional)

**Constraints:**
- `UNIQUE(guest_slug, episode_date, part_number)` - Prevents duplicate parts of same episode
- `UNIQUE(r2_key)` - Prevents same file path used multiple times
- `UNIQUE(sha256)` - Prevents same file content uploaded with different paths

**Current Data (Dec 14, 2025):**
```
JR Riggins Interview - December 14, 2025

Part 1 (JR_RIGGINS_-01.mp3):
  - guest_slug: jr-riggins
  - episode_date: 2025-12-14
  - part_number: 1
  - r2_key: podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3
  - bytes: 8991964
  - sha256: 5acb4d1442e09c8de6900fbb90b580ad7e8303925d6e849187eb910acd990792
  - uploaded_at: 2025-12-14 19:41:30
  - summary: [608 chars] - Part 1 intro and Wyoming energy infrastructure

Part 2 (JR_RIGGINS_-02.mp3):
  - guest_slug: jr-riggins
  - episode_date: 2025-12-14
  - part_number: 2
  - r2_key: podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-02.mp3
  - bytes: 8190449
  - sha256: cb584adf403f6891ca5d8589cea88856843872b993c5dba529ff927b708629e2
  - uploaded_at: 2025-12-14 19:41:30
  - summary: [854 chars] - Data centers, civic participation, public lands

Part 3 (JR_RIGGINS_-03.mp3):
  - guest_slug: jr-riggins
  - episode_date: 2025-12-14
  - part_number: 3
  - r2_key: podcasts/jr-riggins/2025-12-14/JR_RIGGINS_-03.mp3
  - bytes: 15564907
  - sha256: 82e7c736373dbcce663afbbd4d4c93b622f7af9207b62726d12cdfd2dc1fe26e
  - uploaded_at: 2025-12-14 19:41:30
  - summary: [995 chars] - Social media, legislature, college sports NIL
```

**Migrations:**
- `0021_create_podcast_uploads.sql` - Creates table with deduplication constraints
- `0022_add_summary_to_podcast_uploads.sql` - Adds optional summary field

**Access Patterns:**
```sql
-- Query episode by guest and date
SELECT * FROM podcast_uploads 
WHERE guest_slug = 'jr-riggins' AND episode_date = '2025-12-14'
ORDER BY part_number;

-- Check for duplicate files before upload
SELECT COUNT(*) FROM podcast_uploads 
WHERE sha256 = ?  OR r2_key = ?;

-- Get episode summary for display
SELECT part_number, summary FROM podcast_uploads
WHERE guest_slug = ? AND episode_date = ?;

-- List all episodes
SELECT DISTINCT guest_slug, episode_date, COUNT(*) as parts 
FROM podcast_uploads 
GROUP BY guest_slug, episode_date 
ORDER BY episode_date DESC;
```

---

## R2 Bucket Configuration

### Podcasts Bucket
**Bucket Name:** `podcasts`
**Custom Domain:** `media.this-is-us.org` (✅ ACTIVE, SSL ✅ ACTIVE)
**Access:** Public read via HTTPS

**File Structure:**
```
podcasts/
└── jr-riggins/
    └── 2025-12-14/
        ├── JR_RIGGINS_-01.mp3 (8.99 MB)
        ├── JR_RIGGINS_-02.mp3 (8.19 MB)
        └── JR_RIGGINS_-03.mp3 (15.56 MB)
```

**Public URLs:**
- Part 1: `https://media.this-is-us.org/jr-riggins/2025-12-14/JR_RIGGINS_-01.mp3`
- Part 2: `https://media.this-is-us.org/jr-riggins/2025-12-14/JR_RIGGINS_-02.mp3`
- Part 3: `https://media.this-is-us.org/jr-riggins/2025-12-14/JR_RIGGINS_-03.mp3`

---

## Hugo Integration

**Audio Shortcode:** `layouts/shortcodes/audio.html`
- Uses `mediaBaseUrl` config parameter to resolve relative paths
- Supports optional `title` and `download` attributes
- Outputs HTML5 `<audio>` element with controls and metadata

**Content Page:** `content/podcast.md`
- Displays podcast information and player
- Three shortcode instances for JR Riggins parts 1-3
- Menu item active in `config.toml` (weight: 10)

**Configuration (config.toml):**
```toml
mediaBaseUrl = "https://media.this-is-us.org"
```

---

## Testing & Validation

**Automated Tests** (./scripts/test.sh):
- ✅ `tests/schema_podcast_uploads.test.sh` - Validates table structure
- ✅ `tests/upload_dedupe.test.sh` - Tests deduplication logic
- ✅ `tests/hugo_shortcode_audio.test.mjs` - Verifies audio shortcode

**Database Sync:**
- ✅ Local D1 in sync with remote
- ✅ Migrations 0021-0022 applied to both environments
- ✅ JR Riggins test data populated on both

---

## Coding Notes for Future Development

### Adding New Episodes
1. Create new guest_slug and episode_date records
2. Use upload script: `scripts/media/r2_upload_podcasts.sh --local --guest SLUG --date DATE`
3. Script automatically: computes SHA256, uploads to R2, inserts D1 records
4. Add summary via D1 UPDATE: `UPDATE podcast_uploads SET summary = '...' WHERE ...`

### Deduplication Logic
- Before upload: Check `SELECT * FROM podcast_uploads WHERE sha256 = ? OR r2_key = ?`
- If exists: Skip upload (prevent duplicates)
- If new: Upload to R2, insert record, trigger on_success callback

### Episode Queries
```javascript
// Get all parts of an episode
const parts = await db.prepare(
  `SELECT * FROM podcast_uploads 
   WHERE guest_slug = ? AND episode_date = ? 
   ORDER BY part_number`
).bind(slug, date).all();

// Check before uploading
const exists = await db.prepare(
  `SELECT 1 FROM podcast_uploads WHERE sha256 = ?`
).bind(fileHash).first();
```

---

## Related Files & Scripts

- **Migration Files:** `worker/migrations/0021_*.sql`, `0022_*.sql`
- **Upload Script:** `scripts/media/r2_upload_podcasts.sh` (D1 + R2 integration)
- **Status Script:** `scripts/media/podcast_status.sh` (query podcast_uploads)
- **Test Files:** `tests/schema_podcast_uploads.test.sh`, `tests/upload_dedupe.test.sh`
- **Documentation:** `PODCAST_IMPLEMENTATION.md`, `PODCAST_QUICK_REFERENCE.md`

---

## Migration File Inventory

### EVENTS_DB Migrations (worker/migrations/)
**Total:** 25 files (some duplicates numbered 0023)

**Applied Locally:** 0001-0006 (6 files)
```
✓ 0001_add_events_table.sql
✓ 0002_add_contact_fields.sql
✓ 0003_add_pdf_key_to_events.sql
✓ 0004_add_description_pdfhash.sql
✓ 0005_add_preferences.sql
✓ 0006_seed_topic_index.sql
```

**Not Applied Locally (Exist on Disk, Applied Remotely):** 0007-0025 (19 files)
```
✗ 0007_create_user_preferences.sql
✗ 0008_add_city_state_to_user_preferences.sql
✗ 0009_add_timestamp_to_user_topic_prefs.sql
✗ 0010_add_voters_addr_norm_test_fixture.sql
✗ 0011_create_hot_topics.sql
✗ 0012_add_match_metadata_to_hot_topic_civic_items.sql
✗ 0013_migrate_hot_topics_schema.sql
✗ 0014_migrate_hot_topic_civic_items_schema.sql
✗ 0015_add_match_criteria_json_to_hot_topics.sql
✗ 0016_create_townhall_posts.sql
✗ 0017_align_preferences_to_hot_topics.sql
✗ 0018_create_townhall_replies.sql
✗ 0019_add_county_to_townhall_posts.sql
✗ 0020_update_hot_topics_keywords.sql
✗ 0021_create_podcast_uploads.sql (Dec 14)
✗ 0022_add_summary_to_podcast_uploads.sql (Dec 14)
✗ 0024_add_unique_constraint_civic_item_ai_tags.sql
✗ 0025_update_hot_topics_for_test_data.sql
```

### WY_DB Migrations (worker/migrations_wy/)
**Total:** 25 files (has duplicate migration numbers: 2x 0015, 2x 0025)

**Applied Locally:** 0001-0005 (5 files)
```
✓ 0001_create_base_schema.sql
✓ 0002_add_normalization_tables.sql
✓ 0003_update_city_county_schema.sql
✓ 0004_populate_city_county_lookup.sql
✓ 0005_drop_unused_columns.sql
```

**Not Applied Locally (Exist on Disk, Applied Remotely):** 0006-0025 (20 files)
```
✗ 0006_create_civic_items.sql
✗ 0007_create_user_ideas.sql
✗ 0008_create_votes.sql
✗ 0009_add_civic_item_ai_tags.sql
✗ 0010_add_reason_summary_to_civic_item_ai_tags.sql
✗ 0011_add_ai_summary_fields_to_civic_items.sql
✗ 0012_create_bill_sponsors.sql
✗ 0013_create_wy_legislators.sql
✗ 0014_add_lat_lng_to_voters_addr_norm.sql
✗ 0015_create_civic_item_sources.sql [#1 of 2]
✗ 0015_update_whitehall_coordinates.sql [#2 of 2 - DUPLICATE!]
✗ 0016_import_geocoded_coordinates.sql
✗ 0017_import_expanded_geocoded_coordinates.sql
✗ 0018_create_verified_users.sql
✗ 0019_create_civic_item_verification.sql
✗ 0020_add_openstates_person_id_to_bill_sponsors.sql
✗ 0021_add_structural_fields_to_civic_item_verification.sql
✗ 0022_populate_wy_legislators.sql
✗ 0023_add_lso_hydration_fields.sql
✗ 0024_add_unique_civic_item_ai_tags.sql
✗ 0025_create_civic_item_sources.sql [#1 of 2]
✗ 0025_create_civic_item_sources.sql [#2 of 2 - DUPLICATE NAME!]
```

**⚠️ ISSUE:** migrations_wy/ has duplicate migration numbers (0015 x2, 0025 x2) which may cause ordering confusion when migrations are applied.

---

## Database File Locations

### Local D1 State Directory
```
../scripts/wr/state/v3/d1/miniflare-D1DatabaseObject/
├── c823efd7...sqlite        (EVENTS_DB - 64 KB, 6 migrations)
├── c823efd7...sqlite-shm    (shared memory file)
├── c823efd7...sqlite-wal    (write-ahead log)
├── 532b3e00...sqlite        (WY_DB - 96 KB, 5 migrations)
├── 532b3e00...sqlite-shm
├── 532b3e00...sqlite-wal
├── 9db7bd9f...sqlite        (BALLOT_DB - 0 bytes, empty)
└── ... (R2 bucket state files)
```

### Migration Source Directories
```
worker/
├── migrations/              (25 migration files for EVENTS_DB)
├── migrations_wy/           (25 migration files for WY_DB)
└── migrations/applied/      (4 archived migration files)
```

---

**Last Updated:** December 15, 2025, 21:30 UTC
**Verified By:** SQLite queries + ./scripts/wr d1 execute (local state inspection)
**Status:** ⚠️ LOCAL DB STALE | ✅ REMOTE DB CURRENT | 🔧 Recovery available
