# Database Snapshot – December 14, 2025

## Overview
This document captures the current state of the This Is Us project's D1 databases, including schemas, tables, indexes, and access patterns as of December 14, 2025.

**Recent Updates (December 14, 2025):**
- Added **podcast_uploads** table to EVENTS_DB for tracking podcast files, deduplication, and episode metadata
- Implemented R2 integration with custom domain (media.this-is-us.org) for audio file hosting
- Added summary field to podcast_uploads for episode descriptions and chapter points
- All podcast metadata synced across local and remote D1 environments
- First episode (JR Riggins, 3 parts) fully cataloged with summaries and R2 links

---

## D1 Databases Configuration

The project uses **2 active D1 databases** across local development, preview, and production environments:

### 1. EVENTS_DB (Primary Application DB)
**Bindings & IDs:**
- Local: `events_db_local` (ID: `6c3fffd4-e6dc-47b8-b541-3857c2882e0c`)
- Preview: `events_db_preview` (ID: `1624450c-f228-4802-8a76-9c65f29295fa`)
- Production: `events_db` (ID: `b5814930-2779-4bfb-8052-24ee419e09fd`)

**Current State:** 14 tables (hot_topics infrastructure + podcast uploads)
**Size:** ~100 KB (local)
**Migrations Applied:** 0001-0022 (podcast updates as of Dec 14, 2025)
**New Additions:** podcast_uploads table (0021) + summary field (0022)

### 2. WY_DB (Wyoming Civic Data)
**Bindings & IDs:**
- Local: `wy` (ID: `4b4227f1-bf30-4fcf-8a08-6967b536a5ab`)
- Preview: `wy_preview` (ID: `de78cb41-176d-40e8-bd3b-e053e347ac3f`)
- Production: `wy` (ID: `4b4227f1-bf30-4fcf-8a08-6967b536a5ab`)

**Current State:** 16 tables (core voter data, civic items, street indexes)
**Size:** ~111 MB (production) | **Voter Records:** 274,656 normalized addresses
**Tables:** voters, voters_addr_norm, civic_items, votes, streets_index, etc.

---

## EVENTS_DB Schema (Detail)

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

**Last Updated:** December 14, 2025, 21:00 UTC
**Verified By:** Schema verification via wrangler d1 execute (PRAGMA table_info)
**Status:** ✅ All systems operational, ready for production
