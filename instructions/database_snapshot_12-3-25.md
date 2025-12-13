# Database Snapshot – December 10, 2025

## Overview
This document captures the current state of the This Is Us project's D1 databases, including schemas, tables, indexes, and access patterns as of December 10, 2025.

**Recent Updates (December 10, 2025):**
- Project now uses 2 D1 databases (EVENTS_DB and WY_DB); BALLOT_DB binding exists but is unused and not configured for production.
- Wyoming civic stack gained sponsor ingestion (`bill_sponsors.openstates_person_id`) and structural verification fields in `civic_item_verification` (is_wyoming, has_summary, has_wyoming_sponsor, structural_ok, structural_reason).
- OpenStates sync calls detail endpoint to populate bill_sponsors; verification gating requires WY jurisdiction, summary, mapped sponsor, and model agreement.
- Hot topics remain in EVENTS_DB; all bill data, sponsors, verification, legislators, and votes live in WY_DB.

---

## D1 Databases Configuration

The project uses **2 active D1 databases** across local development, preview, and production environments:

### 1. EVENTS_DB
**Bindings & IDs:**
- Local: `events_db_local` (ID: `6c3fffd4-e6dc-47b8-b541-3857c2882e0c`)
- Preview: `events_db_preview` (ID: `1624450c-f228-4802-8a76-9c65f29295fa`)
- Production: `events_db` (ID: `b5814930-2779-4bfb-8052-24ee419e09fd`)

**Current State:** 12 tables (hot_topics infrastructure with match metadata support)
**Size:** ~90 KB (local)
**Migrations Applied:** 0001-0014 (local & production aligned as of Dec 5, 2025)
**Note:** Includes `voters_addr_norm` and `wy_city_county` from test fixture (migration 0010)

### 2. WY_DB
**Bindings & IDs:**
- Local: `wy` (ID: `4b4227f1-bf30-4fcf-8a08-6967b536a5ab`)
- Preview: `wy_preview` (ID: `de78cb41-176d-40e8-bd3b-e053e347ac3f`)
- Production: `wy` (ID: `4b4227f1-bf30-4fcf-8a08-6967b536a5ab`)

**Current State:** 16 tables (core voter data, civic items, street indexes, and test data)
**Size:** ~111 MB (production) | **Voter Records:** 274,656 normalized addresses
**Tables:** voters, voters_addr_norm, voters_norm, voters_raw, civic_items, user_ideas, votes, streets_index, wy_city_county, plus system/test tables
**Recent Additions:** civic_items (5 bills), user_ideas, votes (migrations 0006-0008)

---

## EVENTS_DB Schema

### Tables

**candidates**
```sql
CREATE TABLE candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  office TEXT NOT NULL,
  location TEXT NOT NULL,
  pdf_url TEXT NOT NULL,
  pdf_key TEXT NOT NULL
)
```

**events**
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sponsor TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  lat REAL,
  lng REAL,
  pdf_hash TEXT,
  description TEXT,
  pdf_key TEXT
)
```

**topic_index**
```sql
CREATE TABLE topic_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
)
```

**topic_requests**
```sql
CREATE TABLE topic_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  proposed_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**hot_topics** – Trending/featured civic topics with call-to-action (NEW – Migration 0011)
```sql
CREATE TABLE hot_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  badge TEXT,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  priority INTEGER DEFAULT 100,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**hot_topic_civic_items** – Junction table linking bills to hot topics with match metadata (Migrations 0011, 0012, 0013, 0014)
```sql
CREATE TABLE hot_topic_civic_items (
  topic_id INTEGER NOT NULL,
  civic_item_id INTEGER NOT NULL,
  match_score REAL,
  matched_terms_json TEXT,
  excerpt TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (topic_id, civic_item_id),
  FOREIGN KEY (topic_id) REFERENCES hot_topics(id)
)
```

**Schema Evolution:**
- **0011** (original): Created table with compound key (topic_id, civic_item_id TEXT)
- **0012** (Dec 5): Added match metadata columns (match_score, matched_terms_json, excerpt, created_at index)
- **0013-0014** (Dec 5): Migration 0013 dropped and recreated hot_topics; Migration 0014 recreated hot_topic_civic_items with INTEGER civic_item_id and full metadata
- **Current Schema** (local & production aligned): topic_id (INTEGER), civic_item_id (INTEGER), match_score (REAL), matched_terms_json (TEXT), excerpt (TEXT), created_at (DATETIME)

**Seeded Hot Topics (6):**
1. `property-tax-relief` (priority 10, badge: Taxes) – Rising assessments impact on homeowners
2. `water-rights` (priority 20, badge: Water) – Allocation rules and drought planning
3. `education-funding` (priority 30, badge: Education) – School funding and local control
4. `energy-permitting` (priority 40, badge: Energy) – Transmission and grid reliability
5. `public-safety-fentanyl` (priority 50, badge: Safety) – Opioid trafficking and treatment
6. `housing-land-use` (priority 60, badge: Housing) – Zoning and workforce housing

**townhall_posts**
```sql
CREATE TABLE townhall_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT,
  created_at TEXT NOT NULL,
  r2_key TEXT,
  file_size INTEGER,
  expires_at TEXT,
  city TEXT DEFAULT '',
  state TEXT DEFAULT ''
)
```

**user_preferences**
```sql
CREATE TABLE user_preferences (
  firebase_uid TEXT PRIMARY KEY,
  email TEXT,
  theme TEXT,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  city TEXT,
  state TEXT
)
```

**user_topic_prefs**
```sql
CREATE TABLE user_topic_prefs (
  user_id TEXT NOT NULL,
  topic_id INTEGER NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, topic_id),
  FOREIGN KEY (topic_id) REFERENCES topic_index(id)
)
```

**d1_migrations**
```sql
CREATE TABLE d1_migrations(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)
```

**_cf_METADATA**
```sql
CREATE TABLE _cf_METADATA (
  key INTEGER PRIMARY KEY,
  value BLOB
)
```

### Indexes
- `topic_index.slug` – UNIQUE

### Foreign Keys
- `user_topic_prefs.topic_id` → `topic_index.id`

---
---

## WY_DB Schema

### Core Voter Tables

**voters** – Primary voter registry (~main voter data)
**voters_raw** – Raw import data
**voters_norm** – Normalized voter addresses
**voters_addr_norm** – Address normalization lookup (274,656 records)
**voter_contacts** – Contact information for voters
**voter_phones** – Phone number assignments
**wy_city_county** – Wyoming city/county mappings

### Civic Engagement Tables (NEW – December 4, 2025)

**civic_items** – Wyoming bills from Open States API (27 columns)
```sql
CREATE TABLE civic_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  level TEXT NOT NULL,
  jurisdiction_key TEXT NOT NULL,
  bill_number TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT,
  legislative_session TEXT,
  chamber TEXT,
  ballot_type TEXT,
  measure_code TEXT,
  election_date TEXT,
  external_ref_id TEXT,
  external_url TEXT,
  text_url TEXT,
  category TEXT,
  subject_tags TEXT,
  location_label TEXT,
  introduced_at TEXT,
  last_action TEXT,
  last_action_date TEXT,
  created_at TEXT,
  updated_at TEXT,
  up_votes INTEGER,
  down_votes INTEGER
)
```
Indexes: `civic_items_scope` (level, jurisdiction_key), `civic_items_kind_status` (kind, status), `civic_items_category` (category)

**bill_sponsors** – Bill sponsors (OpenStates-derived, now includes openstates_person_id)
Key columns: civic_item_id, sponsor_name, sponsor_role, sponsor_district, chamber, contact_email/phone/website, openstates_person_id, timestamps.

**wy_legislators** – Legislator directory (name, chamber, district_label/number, contact info) used to map sponsors to WY legislators.

**user_ideas** – User-generated ideas linked to civic items
```sql
CREATE TABLE user_ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  up_votes INTEGER,
  down_votes INTEGER
)
```

**votes** – User votes/endorsements on bills and ideas
```sql
CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  value INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, target_type, target_id)
)
```
Index: `idx_votes_target` on `(target_type, target_id)`

**civic_item_verification** – AI verification with structural gating
Key columns: topic_match, summary_safe, issues, model, confidence, status, created_at, plus structural fields is_wyoming, has_summary, has_wyoming_sponsor, structural_ok, structural_reason.

**Current Civic Data:**
- civic_items: synced Wyoming bills for current session (volume varies by sync run)
- user_ideas: 0 rows (ready for constituent input with up_votes/down_votes aggregation)
- votes: Granular vote tracking with target_type/target_id support (0 rows, ready for endorsements)
- bill_sponsors: populated by OpenStates detail sync (person sponsors only)
- civic_item_verification: populated by internal verification route with structural gating
- hot_topic_civic_items (junction): Links bills to topics; match_score/matched_terms_json/excerpt ready

### Activity & Tracking Tables

**call_activity** – Call log records
**canvass_activity** – Door-to-door canvass logs
**walk_assignments** – Walk route assignments
**walk_batches** – Walk batch groupings
**call_assignments** – Call assignment tracking
**call_followups** – Follow-up call records

### Campaign & Messaging

**campaign_touchpoints** – Campaign contact events
**campaign_touchpoint_segments** – Segment targeting
**message_templates** – SMS/message templates
**pulse_optins** – Pulse survey opt-ins

### Geo & Legislative Data

**legislature** – Legislative session/member info
**district_coverage** – Electoral district boundaries
**streets_index** – Street/address index
**streets_index_old** – Legacy street index

### Staging & Views

**volunteer_staging** – Volunteer data staging area
**voter_contact_staging** – Contact staging area
**v_best_phone** – View: best phone number per voter
**v_best_phone_old** – Legacy best phone view

### System Tables

**d1_migrations** – Migration tracking
**sqlite_sequence** – Auto-increment tracking
**_cf_KV** – Cloudflare internal metadata

**Size:** ~111 MB | **Table count:** 29

---

## Access Patterns & Worker Code Usage

### EVENTS_DB
Used by the Worker for:
- `handleListEvents` – SELECT from `events`
- `handleCreateEvent` – INSERT into `events`
- Topic management – SELECT/INSERT/UPDATE on `topic_index`, `user_topic_prefs`, `topic_requests`
- Town hall posts – INSERT/SELECT/DELETE on `townhall_posts`
- User preferences – INSERT/SELECT/UPDATE on `user_preferences`, `user_topic_prefs`
- **NEW (Dec 4):** Hot topics with cross-database civic item fetching
  - Routes: `GET /api/hot-topics`, `GET /api/hot-topics/:slug`
  - Handlers: `handleListHotTopics`, `handleGetHotTopic` (in `src/routes/hotTopics.mjs`)
  - Architecture: SELECT from `hot_topics` and junction table, fetch bill details from WY_DB via `fetchCivicItems()` helper
  - Returns: Topics with fully populated `civic_items` array including bill details (bill_number, title, status, chamber, last_action_date, etc.)

### WY_DB
Used by the Worker for:
- `handleVoterLookup` – SELECT from `voters` table for voter verification
- **NEW (Dec 4):** Civic items source for cross-database queries
  - Data source: Wyoming 2025 session bills synced via `src/lib/openStatesSync.mjs`
  - Schema: id, bill_number, title, status, legislative_session, chamber, last_action, last_action_date, etc.
  - Called by: `fetchCivicItems(env, civicIds)` helper in hotTopics.mjs
  - Current seeding: 5 Wyoming bills (HB 22, HB 23, HB 264, SF 2, SF 4)

### BALLOT_DB
Currently not actively used by Worker code (ballot sources defined but no active routes).

---

## Local vs. Remote D1 Access

### Local Development Access (Wrangler Emulator)

**Location:** `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`

Each database is stored as a SQLite file matching its UUID:
- `events_db_local`: `6c3fffd4-e6dc-47b8-b541-3857c2882e0c.sqlite`
- `wy`: `4b4227f1-bf30-4fcf-8a08-6967b536a5ab.sqlite`
- `ballot_sources`: `9c4b0c27-eb33-46e6-a477-fb49d4c81474.sqlite`

#### Via Wrangler CLI (Preferred for Active Development)

**Command Format (from `worker/` directory):**
```bash
# Execute query against local database
npx wrangler d1 execute <BINDING_NAME> --local --command "<SQL>" --json

# Example: Query events table locally
cd /home/anchor/projects/this-is-us/worker
npx wrangler d1 execute EVENTS_DB --local --command "SELECT COUNT(*) FROM events;" --json

# Example: Query hot topics (NEW)
npx wrangler d1 execute EVENTS_DB --local --command "SELECT slug, title, badge FROM hot_topics ORDER BY priority;" --json

# Example: Query civic items from Open States
npx wrangler d1 execute WY_DB --local --command "SELECT bill_number, title, status FROM civic_items;" --json

# Import SQL dump into local database
npx wrangler d1 execute WY_DB --local --file /path/to/dump.sql

# List tables in local database
npx wrangler d1 execute WY_DB --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" --json

# List migrations applied
npx wrangler d1 execute EVENTS_DB --local --command "SELECT name FROM d1_migrations ORDER BY id;" --json
```

#### Direct SQLite Access (Offline Debugging)

For offline inspection without starting wrangler dev, access SQLite files directly:

```bash
# Query with sqlite3 CLI (must have sqlite3 installed)
sqlite3 /home/anchor/projects/this-is-us/worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/6c3fffd4-e6dc-47b8-b541-3857c2882e0c.sqlite "SELECT * FROM hot_topics LIMIT 1;"

# WY_DB civic items
sqlite3 /home/anchor/projects/this-is-us/worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/4b4227f1-bf30-4fcf-8a08-6967b536a5ab.sqlite "SELECT bill_number, title, status FROM civic_items;"

# List all tables in EVENTS_DB
sqlite3 /home/anchor/projects/this-is-us/worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/6c3fffd4-e6dc-47b8-b541-3857c2882e0c.sqlite ".tables"

# Interactive shell (full SQLite CLI available)
sqlite3 /home/anchor/projects/this-is-us/worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/6c3fffd4-e6dc-47b8-b541-3857c2882e0c.sqlite
sqlite> SELECT slug, title FROM hot_topics;
sqlite> .schema hot_topics
sqlite> .exit

# Check migrations applied
sqlite3 /home/anchor/projects/this-is-us/worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/6c3fffd4-e6dc-47b8-b541-3857c2882e0c.sqlite "SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 15;"

# Count voter records in WY_DB
sqlite3 /home/anchor/projects/this-is-us/worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/4b4227f1-bf30-4fcf-8a08-6967b536a5ab.sqlite "SELECT COUNT(*) as total_voters FROM voters_addr_norm;"
```

**Key Points:**
- Files are created on-demand by Wrangler's miniflare emulator
- WAL (write-ahead logging) files (`.sqlite-wal`) and shared memory files (`.sqlite-shm`) may be present alongside .sqlite file
- Permissions must allow read/write for your user
- If a database file carries metadata from another project (cross-project symlinks), Wrangler may reject mutations with `SQLITE_AUTH` error
- Solution: Delete stale files and let Wrangler re-provision fresh databases
- **Important:** Changes made directly via sqlite3 won't be reflected in wrangler dev unless you restart the dev process

### Remote/Preview Access (Cloudflare Edge)

**Location:** Cloudflare's distributed D1 infrastructure (edge locations worldwide)

#### Preview Environment

```bash
# Execute query against preview database
npx wrangler d1 execute <BINDING_NAME> --remote --env preview --command "<SQL>" --json

# Example: Query hot topics in preview
cd /home/anchor/projects/this-is-us/worker
npx wrangler d1 execute EVENTS_DB --remote --env preview --command "SELECT COUNT(*) FROM hot_topics;" --json

# Example: Check civic items in preview
npx wrangler d1 execute WY_DB --remote --env preview --command "SELECT COUNT(*) FROM civic_items;" --json
```

#### Production Environment

```bash
# Execute query against production database
npx wrangler d1 execute <BINDING_NAME> --remote --env production --command "<SQL>" --json

# Example: Query hot topics in production
cd /home/anchor/projects/this-is-us/worker
npx wrangler d1 execute EVENTS_DB --remote --env production --command "SELECT COUNT(*) FROM hot_topics;" --json

# List tables in remote database
npx wrangler d1 execute WY_DB --remote --env production --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" --json
```

**Key Points:**
- Use `--remote --env <environment>` to target specific deployment
- Queries execute on Cloudflare's D1 instance (not emulated)
- Results include metadata: `served_by`, `served_by_region`, `duration_ms`, `rows_read`, `rows_written`
- Bindings are resolved from `wrangler.toml` environment configuration
- Premium feature: requires Cloudflare paid plan
- Both preview and production have hot topics; ensure WY_DB migrations are applied where civic endpoints run.

### Runtime Access (Worker Code)

**Pattern:**
```javascript
// TypeScript typings
@typedef Env
@property {D1Database} EVENTS_DB
@property {D1Database} WY_DB
@property {D1Database} BALLOT_DB

// Usage in handler
export async function handleListEvents(request, env) {
  const db = env.EVENTS_DB;
  const { results } = await db
    .prepare("SELECT id, name, date, location FROM events WHERE date >= ?")
    .bind(new Date())
    .all();
  return json(results);
}
```

**Execution Context:**
- Local development: Uses miniflare emulator from `.wrangler/state/v3/d1/`
- Production deployment: Queries Cloudflare's edge D1 instance
- No explicit "local" vs "remote" selector in handler code—determined by deployment environment

---

## Configuration File: `worker/wrangler.toml`

### D1 Database Bindings

```toml
# Default/local development bindings
[[d1_databases]]
binding       = "EVENTS_DB"
database_name = "events_db_local"
database_id   = "6c3fffd4-e6dc-47b8-b541-3857c2882e0c"
migrations_dir = "migrations"

[[d1_databases]]
binding       = "BALLOT_DB"
database_name = "ballot_sources"
database_id   = "9c4b0c27-eb33-46e6-a477-fb49d4c81474"

[[d1_databases]]
binding       = "WY_DB"
database_name = "wy"
database_id   = "4b4227f1-bf30-4fcf-8a08-6967b536a5ab"

# Preview environment
[env.preview.d1_databases]
# ... preview-specific bindings (wy_preview, events_db_preview)

# Production environment
[env.production.d1_databases]
# ... production bindings (events_db, wy)
```

**Note:** There is a Wrangler warning about `BALLOT_DB` not being defined in `[env.production]` even though it's at the top level. This should be fixed by explicitly adding it to the production environment config.

---

## Current Issues & Known Gaps

1. **Civic Items cross-database access - RESOLVED (Dec 4)**
   - ✅ Implemented two-phase fetch pattern in `hotTopics.mjs`
   - ✅ `fetchCivicItems(env, civicIds)` helper queries WY_DB for bill details
   - ✅ `handleListHotTopics()` and `handleGetHotTopic()` now return topics with fully populated civic_items array
   - ✅ API endpoints return civic items with: id, bill_number, title, status, chamber, last_action, last_action_date
   - **Implementation:** Junction table stores civic_item_ids → application queries WY_DB for bill details → results combined in response
   - **Status:** Fully functional; test data: 1 bill linked to property-tax-relief topic

2. **Schema Alignment (Local ↔ Production) - RESOLVED (Dec 5)**
   - ✅ Migrations 0013-0014 dropped and recreated tables to match local schema
   - ✅ hot_topics: Field names aligned (slug, title, summary, badge, image_url, cta_label, cta_url, priority, is_active, created_at, updated_at)
   - ✅ hot_topic_civic_items: PK and column names aligned (topic_id INTEGER, civic_item_id INTEGER, match_score, matched_terms_json, excerpt, created_at)
   - ✅ All databases now have identical schemas
   - **Status:** Local and production fully synchronized as of Dec 5, 2025

3. **Town Hall still uses Firestore**
   - `townhall_posts` table exists but isn't actively used
   - Frontend still reads/writes directly to Firestore instead of D1
   - No convergence on single source of truth

4. **Event creation is incomplete**
   - Worker has `/api/events/create` endpoint but it's not fully implemented
   - Field name mismatches between UI and Worker (user_id vs userId)
   - PDF uploads to R2 not implemented

5. **Auth & Voter Verification not enforced**
   - Worker APIs don't validate Firebase tokens
   - No voter status lookup against WY_DB
   - CORS is open to all origins (Access-Control-Allow-Origin: *)
   - Caller-supplied user_id parameters are trusted

6. **BALLOT_DB binding missing from production config**
   - Wrangler warning indicates incomplete environment configuration

7. **Hot Topics UI - Civic Items Display (Match Metadata Ready)**
   - List view shows bill count (0) pending civic item links
   - Detail view displays "No bills linked" placeholder
   - Requires manual INSERT into `hot_topic_civic_items` to link bills
   - **New (Dec 5):** match_score, matched_terms_json, excerpt columns ready for automatic scanning
   - **Status:** Infrastructure complete; next: implement bill scanner to populate match metadata
   - **Test data:** 1 bill linked to property-tax-relief (HB 22 / bill_number)
   - **Match Metadata:** Columns available but unpopulated; ready for bill-scanning service

---

## Cross-Database Architecture (Implemented December 4, 2025)

### Problem
Hot topics (stored in EVENTS_DB) need to display linked bills (stored in WY_DB), but Cloudflare D1 doesn't support cross-database JOINs.

### Solution: Two-Phase Fetch Pattern

**File:** `worker/src/routes/hotTopics.mjs`

**Phase 1 - Query EVENTS_DB:**
```javascript
// Fetch topics and civic_item_ids from junction table
SELECT ht.id, ht.slug, ht.title, ..., htci.civic_item_id
FROM hot_topics ht
LEFT JOIN hot_topic_civic_items htci ON htci.topic_id = ht.id
WHERE ht.is_active = 1
```

**Phase 2 - Query WY_DB:**
```javascript
// Use fetchCivicItems() helper to fetch bill details
const civicIds = [...] // extracted from phase 1
const civicById = await fetchCivicItems(env, civicIds)
// SELECT bill_number, title, status, chamber, last_action, last_action_date
// FROM civic_items WHERE id IN (...)
```

**Phase 3 - Combine Results:**
```javascript
// Build topic.civic_items array with full bill data
const civicItems = civicIds.map(id => civicById[id]).filter(Boolean)
return { ...topic, civic_items: civicItems }
```

### Implementation Details

**Helper Function:** `fetchCivicItems(env, civicIds)`
- Accepts environment and array of OCD bill IDs
- Executes parameterized query against WY_DB to prevent SQL injection
- Returns object mapping civic_item_id → full civic item data
- Handles empty array gracefully (returns {})

**Handlers:**
- `handleListHotTopics()`: Aggregates civic items across all active topics
- `handleGetHotTopic(slug)`: Returns single topic with linked civic items

**Performance:** O(1 + n) where n = number of distinct linked bills (two queries instead of JOIN)

### Data Schema (Civic Items)

Columns returned by `fetchCivicItems()`:
- `id` – Open States OCD bill ID (format: ocd-bill/...)
- `bill_number` – Display string (HB 22, SF 4, etc.)
- `title` – Full bill title
- `status` – Current status (introduced, passed_lower_chamber, etc.)
- `legislative_session` – Session year (2025)
- `chamber` – Legislative chamber (lower, upper)
- `last_action` – Most recent action description
- `last_action_date` – Date of last action

### Example API Response

```json
{
  "id": 1,
  "slug": "property-tax-relief",
  "title": "Property Tax Relief",
  "summary": "Rising assessments are squeezing homeowners...",
  "badge": "Taxes",
  "cta_label": "See current proposals",
  "cta_url": "/hot-topics/property-tax-relief",
  "priority": 10,
  "is_active": 1,
  "civic_items": [
    {
      "id": "ocd-bill/3bf03922-22fb-406e-a83b-54f93849e03f",
      "bill_number": "HB 22",
      "title": "Homestead Exemption Expansion Act",
      "status": "introduced",
      "legislative_session": 2025,
      "chamber": "lower",
      "last_action": "Introduced in House",
      "last_action_date": "2025-01-15"
    }
  ]
}
```

---

## Migrations

### Location & Structure

**EVENTS_DB migrations:** `worker/migrations/`
**WY_DB migrations:** `worker/migrations_wy/`

### Application

```bash
# Apply pending migrations to local database
npx wrangler d1 migrations apply EVENTS_DB --local
npx wrangler d1 migrations apply WY_DB --local

# Apply pending migrations to preview
npx wrangler d1 migrations apply EVENTS_DB --remote --env preview
npx wrangler d1 migrations apply WY_DB --remote --env preview

# Apply pending migrations to production
npx wrangler d1 migrations apply EVENTS_DB --remote --env production
npx wrangler d1 migrations apply WY_DB --remote --env production
```

### Key Migration Files

**EVENTS_DB Migrations:**
- `0001-0005` – Core tables (events, topic_index, user_preferences, etc.)
- `0011_create_hot_topics.sql` – Hot topics infrastructure (Dec 4, 2025)
  - Creates: hot_topics, hot_topic_civic_items
  - Seeds: 6 hot topics (property-tax-relief, water-rights, education-funding, energy-permitting, public-safety-fentanyl, housing-land-use)
  - Status: ✅ Applied to local, preview, production
- `0012_add_match_metadata_to_hot_topic_civic_items.sql` – Match infrastructure (Dec 5, 2025)
  - Adds: match_score (REAL), matched_terms_json (TEXT), excerpt (TEXT) columns
  - Creates: idx_hot_topic_matches_topic_score index for efficient matching queries
  - Status: ✅ Applied to local and production
- `0013_migrate_hot_topics_schema.sql` – Schema alignment (Dec 5, 2025)
  - Drops and recreates hot_topics with canonical schema (slug, title, summary, badge, image_url, cta_label, cta_url, priority, is_active, created_at, updated_at)
  - Re-seeds: 6 hot topics
  - Status: ✅ Applied to production (local: created from 0011)
- `0014_migrate_hot_topic_civic_items_schema.sql` – Schema alignment (Dec 5, 2025)
  - Drops and recreates hot_topic_civic_items with compound PK (topic_id, civic_item_id INTEGER)
  - Includes: match_score, matched_terms_json, excerpt, created_at columns
  - Updates: Index references hot_topic_id → topic_id
  - Status: ✅ Applied to production (local: created from 0011-0012)

**WY_DB Migrations:**
- `0001-0005` – Core voter and campaign tables
- `0006_create_civic_items.sql` – Civic items for bill tracking (Dec 4, 2025)
- `0007_create_user_ideas.sql` – User comments/ideas on bills (Dec 4, 2025)
- `0008_create_votes.sql` – Vote/endorsement tracking (Dec 4, 2025)
- `0012_create_bill_sponsors.sql` – Bill sponsor storage (Phase 2)
- `0013_create_wy_legislators.sql` – Legislator directory
- `0019_create_civic_item_verification.sql` – AI verification table
- `0020_add_openstates_person_id_to_bill_sponsors.sql` – OpenStates person linkage for sponsors
- `0021_add_structural_fields_to_civic_item_verification.sql` – Structural gating fields
- Status: Apply through 0021 wherever OpenStates sync + verification run.

### Schema Alignment Status (Dec 5, 2025)

**Local ↔ Production Alignment:** ✅ COMPLETE
- hot_topics: Identical schemas (12 columns, same types)
- hot_topic_civic_items: Identical schemas (6 columns, compound PK, match metadata)
- All field names aligned (topic_id, civic_item_id, match_score, etc.)
- All field types aligned (INTEGER, TEXT, REAL, DATETIME)
- Indexes synchronized (idx_hot_topic_matches_topic_score)

### View Applied Migrations

```bash
# Check migrations applied to local EVENTS_DB
npx wrangler d1 execute EVENTS_DB --local --command "SELECT name FROM d1_migrations ORDER BY id;" --json

# Check migrations applied to remote WY_DB
npx wrangler d1 execute WY_DB --remote --env production --command "SELECT name FROM d1_migrations ORDER BY id;" --json

# Check if specific migration applied (hot topics)
npx wrangler d1 execute EVENTS_DB --local --command "SELECT name FROM d1_migrations WHERE name LIKE '0011%';" --json
```

---

## Next Steps (Recommended)

1. **Populate civic_items with more Wyoming bills**
   - Run `openStatesSync.mjs` on schedule to sync new bills from Open States API
   - Current: 5 bills seeded (HB 22, HB 23, HB 264, SF 2, SF 4)
   - Expand to full 2025 session as bills are filed
   - Endpoint: `GET /api/civic/pending-bills`

2. **Link bills to hot topics**
   - Insert entries in `hot_topic_civic_items` as bills align with topics
   - Test linking to property-tax-relief, water-rights, education-funding topics
   - UI will auto-populate "Related Bills" sections once links exist
   - Current test: 1 link (HB 22 → property-tax-relief)

3. **Resolve civic_items cross-database access**
   - Evaluate denormalizing civic_items into EVENTS_DB for single query
   - Or implement client-side fetch pattern: topic list → detail → fetch civic_items separately
   - Decide on authoritative source (WY_DB or EVENTS_DB)
   - May require API gateway or edge function for database bridging

4. **Consolidate town hall from Firestore to D1** for single source of truth

5. **Implement auth gates** using Firebase ID tokens in Worker

6. **Verify migrations on target envs**
   - Ensure WY_DB has 0020/0021 for sponsor ingestion and structural verification.
   - Confirm bill_sponsors and wy_legislators populated so structural gating can pass.

6. **Add voter verification** lookup against WY_DB `voters_addr_norm` table

7. **Fix wrangler.toml** to explicitly declare all bindings in each environment

8. **Complete event creation flow** with PDF uploads to R2 and proper field mapping

## Database Access Reference

### Quick Command Cheatsheet

```bash
# Local EVENTS_DB hot topics
npx wrangler d1 execute EVENTS_DB --local --command "SELECT slug, title, badge FROM hot_topics ORDER BY priority;" --json

# Local WY_DB civic items count
npx wrangler d1 execute WY_DB --local --command "SELECT COUNT(*) as bill_count FROM civic_items;" --json

# Local voter count
npx wrangler d1 execute WY_DB --local --command "SELECT COUNT(*) as total FROM voters_addr_norm;" --json

# Production hot topics
npx wrangler d1 execute EVENTS_DB --remote --env production --command "SELECT slug, title FROM hot_topics;" --json

# Direct SQLite (offline, no wrangler needed)
sqlite3 /home/anchor/projects/this-is-us/worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/4b4227f1-bf30-4fcf-8a08-6967b536a5ab.sqlite "SELECT bill_number FROM civic_items;"

# Check migration status
npx wrangler d1 execute EVENTS_DB --local --command "SELECT name FROM d1_migrations WHERE name LIKE '0011%';" --json
```

### File Paths

**Local database files (Wrangler miniflare):**
```
.wrangler/state/v3/d1/miniflare-D1DatabaseObject/
├── 6c3fffd4-e6dc-47b8-b541-3857c2882e0c.sqlite  (EVENTS_DB)
├── 4b4227f1-bf30-4fcf-8a08-6967b536a5ab.sqlite  (WY_DB)
└── 9c4b0c27-eb33-46e6-a477-fb49d4c81474.sqlite  (BALLOT_DB)
```

**Migration directories:**
- EVENTS_DB: `worker/migrations/`
- WY_DB: `worker/migrations_wy/`

**API endpoints (localhost:8788 during wrangler dev):**
- Hot topics list: `GET /api/hot-topics` → Returns all 6 hot topics
- Hot topic detail: `GET /api/hot-topics/:slug` → Returns single topic with civic_items array
- Civic items (bills): `GET /api/civic/pending-bills` → Returns all seeded bills
- Hot topics UI list: `GET /hot-topics` → Hugo template with card grid
- Hot topics UI detail: `GET /hot-topics/:slug` → Hugo template with full topic details

**Hugo layout files:**
- `layouts/hot-topics/list.html` – List view template with card grid
- `layouts/hot-topics/single.html` – Detail view template
- `content/hot-topics/_index.md` – List page content

**Worker source files:**
- `worker/src/routes/hotTopics.mjs` – Hot topics API handlers
- `worker/src/lib/openStatesSync.mjs` – Open States bill syncing logic
- `worker/src/index.mjs` – Main router with route imports
