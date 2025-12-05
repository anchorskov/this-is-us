# Cloudflare D1 Snapshot – This Is Us (2025-12-04)

This note captures the current D1 schema, how each table is used by Hugo/Workers, and the immediate scaffolding we still need while we redesign data management.

## Active Databases & Bindings
- `EVENTS_DB` (primary Worker binding) – serves events, townhall posts, preferences, topics, and candidate references.
- `BALLOT_DB` – reserved for ballot sources (not detailed here; no schema files found).
- `WY_DB` (4b4227f1-bf30-4fcf-8a08-6967b536a5ab) – Wyoming voter database with 274,656 voter records; independent from grassrootsmvt.
- Local helpers sometimes sync from `data/*.sql` before seeding `EVENTS_DB`.

## Tables & Columns

### `events`
Source: `worker/migrations/applied/0001-0004`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK AUTOINCREMENT | Primary identifier exposed to UI |
| `user_id` | TEXT/INTEGER | Creator’s Firebase UID (currently plain text) |
| `name` | TEXT NOT NULL | Event title |
| `date` | DATE NOT NULL | ISO date |
| `location` | TEXT NOT NULL | Free-form |
| `created_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | Audit |
| `sponsor` | TEXT | Optional org |
| `contact_email` | TEXT | form field |
| `contact_phone` | TEXT | form field |
| `lat` / `lng` | REAL | Map markers |
| `pdf_key` | TEXT | R2 object key |
| `pdf_hash` | TEXT | Duplicate detection |
| `description` | TEXT | Long form summary |

Indexes: `idx_events_pdf_hash` (prod dump). Needs composite `(date, location)` for map queries.

### `candidates`
Source: `worker/prod_dump.sql`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK AUTOINCREMENT |
| `name` | TEXT NOT NULL |
| `office` | TEXT NOT NULL |
| `location` | TEXT NOT NULL |
| `pdf_url` | TEXT NOT NULL |
| `pdf_key` | TEXT NOT NULL (R2) |

Currently no migrations in repo; data seeded manually.

### `townhall_posts`
Sources: `worker/prod_dump.sql`, `data/0001_create_townhall_posts.sql`, Worker handlers (`worker/src/townhall/*.js`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID generated in Worker |
| `user_id` | TEXT NOT NULL | Provided by client (needs server enforcement) |
| `title` | TEXT NOT NULL |
| `prompt` | TEXT | Body text |
| `created_at` | TEXT (ISO) |
| `r2_key` | TEXT | Optional PDF stored in `EVENT_PDFS` |
| `file_size` | INTEGER | Bytes |
| `expires_at` | TEXT | Auto-expire after 90 days |
| `city` / `state` | TEXT | Added in JSON seeds but not enforced in Worker yet |

### `topic_index`
Source: `worker/migrations/0005_add_preferences.sql` & `0006_seed_topic_index.sql`.

Columns: `id` (PK), `name`, `slug` UNIQUE.

### `user_topic_prefs`
Source: `worker/migrations/0005` + `0009`.

Columns: `user_id`, `topic_id`, `updated_at`. PK `(user_id, topic_id)` with triggers to stamp `updated_at` on insert/update.

### `topic_requests`
Source: `worker/migrations/0005`.

Columns: `id` PK, `user_id`, `user_email`, `proposed_name`, `status`, `submitted_at`.

### `user_preferences`
Source: `worker/migrations/0007-0008`.

Columns: `firebase_uid` PK, `email`, `theme`, `notifications_enabled` (BOOLEAN), `last_updated` (timestamp), `city`, `state`.

## WY_DB Tables (Wyoming Voter Data)

### `voters_addr_norm`
Source: `worker/migrations_wy/0001_create_base_schema.sql` (schema), data imported from `/home/anchor/projects/grassrootsmvt/exports/voters_addr_norm.csv`.

| Column | Type | Notes |
|--------|------|-------|
| `voter_id` | TEXT PK | Voter identifier |
| `ln` | TEXT NOT NULL | Last name |
| `fn` | TEXT NOT NULL | First name |
| `addr1` | TEXT NOT NULL | Street address |
| `city` | TEXT NOT NULL | Wyoming city |
| `state` | TEXT NOT NULL | Always "WY" |
| `zip` | TEXT NOT NULL | Postal code |
| `senate` | TEXT NOT NULL | Senate district |
| `house` | TEXT NOT NULL | House district |
| `city_county_id` | INTEGER NOT NULL | Foreign key to `wy_city_county.id` |

**Record Count:** 274,656 (100% complete, no nulls)
**Indexes:** `idx_voters_city`, `idx_voters_voter_id`, `idx_voters_city_county_id`
**Deprecated Columns:** `street_index_id`, `addr_raw` (removed in migration 0005 due to corruption)

### `wy_city_county`
Source: `worker/migrations_wy/0001_create_base_schema.sql` (schema), `worker/migrations_wy/0004_populate_city_county_lookup.sql` (data).

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Mapping ID |
| `city` | TEXT | City name |
| `county` | TEXT | County name |
| `state` | TEXT | Always "WY" |
| `city_norm` | TEXT | Normalized city (added in migration 0003) |
| `county_norm` | TEXT | Normalized county (added in migration 0003) |
| `city_raw` | TEXT | Raw city value |
| `county_raw` | TEXT | Raw county value |

**Record Count:** 38 Wyoming city-county mappings
**Usage:** Joined via `voters_addr_norm.city_county_id` to enable county-based filtering in voter lookups

**Sample Mappings:**
- id=1: LARAMIE/ALBANY
- id=25: GILLETTE/CAMPBELL  
- id=104: CHEYENNE/LARAMIE
- id=129: CASPER/NATRONA
- id=168: ROCK SPRINGS/SWEETWATER

## Known Gaps / TODO
1. **Auth enforcement:** Workers trust `user_id` supplied in form bodies; need to verify via Firebase token and derive UID server-side for `events`, `townhall_posts`, and `topic_requests`.
2. **Geo columns:** `townhall_posts` table has `city/state`, but Worker create handler never populates them.
3. **Indexes:** Frequent queries (events by date, townhall posts by `created_at`) only have implicit PK scans—add indexes once workload defined.
4. **Migrations hygiene:** `worker/migrations/applied/0004_add_description_pdfhash.sql` duplicates prior ALTER statements and contains a trailing space in filename; tidy before new migrations.
5. **Candidates schema:** No migration files exist, so new environments can’t recreate table without `prod_dump`.

## Suggested Copilot Prompts (Data Foundation First)
Use these short prompts next to empty files or TODO blocks:

1. **`worker/src/utils/d1-events.ts`:**  
   “Create a typed repository for the `events` table with `listUpcoming`, `insertEventWithPdf`, and `findByPdfHash`. Use the Cloudflare D1 binding and parameterized queries.”

2. **`worker/src/townhall/createPost.js` refactor:**  
   “Given a validated `userId` and form payload, insert into `townhall_posts` including optional city/state, enforce 2 MB limit, and return the persisted row.”

3. **`worker/src/routes/api/user-topics/index.js`:**  
   “Add pagination and optional `updatedSince` filter when listing topics from `topic_index` joined with `user_topic_prefs`.”

4. **`worker/src/lib/auth.js`:**  
   “Add a helper that extracts Firebase ID tokens from cookies or headers and returns `{ uid, email_verified }`, throwing 401 if missing.”

5. **`scripts/d1-backup.sh`:**  
   “Write a bash script that exports all `EVENTS_DB` tables (events, candidates, townhall_posts, topic_index, user_topic_prefs, topic_requests, user_preferences) into timestamped `.sql` files using `wrangler d1 execute … .dump`.”

6. **`documentation/open_states_update.md`:**  
   “Insert a section describing how the Open States ingest Worker will reuse the existing D1 helpers and what new tables (bills, bill_actions, bill_snapshots) we plan to add.”

## Next Data Steps
1. Normalize migrations: add new numbered files for `candidates` table and any schema currently only in prod dumps.
2. Build small TypeScript repositories per table (events, townhall, topics) so Worker routes stop inlining SQL.
3. Add snapshot tables for Open States work once schema approved.
4. Set up automated nightly `wrangler d1 backup` into Cloudflare R2 or Git LFS for traceability.
