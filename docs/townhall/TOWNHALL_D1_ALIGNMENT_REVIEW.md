# Town Hall D1 Alignment Review & Fixes

**Date**: December 9, 2025
**Status**: ✅ COMPLETE – Ready for code implementation
**Reviewer**: Architecture Review
**For**: Codex (code implementation team)

---

## Executive Summary

The Town Hall D1 infrastructure exists and is **partially functional** but has critical **code-schema misalignments** that will cause runtime errors when Codex moves thread creation from Firestore to D1. 

**Key Findings**:
1. ✅ `townhall_posts` table exists in production EVENTS_DB
2. ✅ GET `/api/townhall/posts` endpoint exists and functional (with caveats)
3. ❌ **BUG**: listPosts.js queries columns that don't exist (`county_name`, `topic_slug`)
4. ❌ **BUG**: createPost.js doesn't populate city/state even though schema has them
5. ❌ **MISSING**: Migration file for townhall_posts (not in worker/migrations/)

**Impact**: When Codex updates create-thread.js to POST to `/api/townhall/create`, the response will succeed, but GET `/api/townhall/posts` will fail with "no such column" error.

**Recommended Action**: 
- Fix the code bugs in listPosts.js and createPost.js (5 min)
- Create a migration file for townhall_posts (10 min)
- No schema changes needed (table is already correct)

---

## Detailed Analysis

### 1. Schema Status: ACTUAL vs. DOCUMENTED

**Production Schema** (confirmed in EVENTS_DB):
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

**Columns**: 10 total
- `id`, `user_id`, `title`, `prompt`, `created_at` (required core fields)
- `r2_key`, `file_size`, `expires_at` (file metadata)
- `city`, `state` (location metadata, default empty strings)

**Status**: Schema matches documentation in `instructions/database_snapshot_12-3-25.md` and `documentation/d1_raw_output.txt`. ✅ **Schema is correct**.

---

### 2. Migration File Status

**Current State**: 
- Migrations exist: `worker/migrations/0001_add_events_table.sql` through `0015_add_match_criteria_json_to_hot_topics.sql`
- townhall_posts table: **NOT found** in any migration file
- Table exists: **YES** (in production EVENTS_DB, confirmed via d1_raw_output.txt)

**Root Cause**: The table was created manually or via a separate process, not through the standard migration system. This means:
- ✅ It works in production
- ❌ Local dev might not have it (depends on initial schema sync)
- ⚠️ New environments won't get it automatically

**Recommendation**: Create migration file `0016_create_townhall_posts.sql` for consistency and future environments.

---

### 3. GET /api/townhall/posts Implementation Issues

**File**: `worker/src/townhall/listPosts.js`

**Issue #1: Missing columns in SELECT**
```javascript
// LINE 13 - CURRENT (BROKEN)
let query = `SELECT id, user_id, title, prompt, created_at, r2_key, file_size, expires_at
             FROM townhall_posts`;

// PROBLEM: This query DOES NOT SELECT county_name or topic_slug
// But lines 26-27 try to use them:
      county_name: p.county_name || null,  // ← p.county_name is undefined
      topic_slug: p.topic_slug || null,    // ← p.topic_slug is undefined
```

**Impact**: 
- Query succeeds (those columns don't exist in schema, but the SELECT just omits them)
- Response will have `county_name: null` and `topic_slug: null` for every post
- This is "silent failure" - not technically a SQL error, but wrong data

**Fix**: Either:
- **Option A** (Remove from response): Don't include county_name/topic_slug in response JSON
- **Option B** (Add to schema): Add these columns to townhall_posts if Town Hall will use topic tagging like Civic Watch does
- **Option C** (Add to schema + populate): Same as B, but also populate in createPost

**Recommendation**: **Option A (Remove)** - Keep the table simple for Phase 1. Topic tagging can be added later if needed.

---

### 4. POST /api/townhall/create Implementation Issues

**File**: `worker/src/townhall/createPost.js`

**Issue #1: Missing city/state in INSERT**
```javascript
// LINES 58-62 - CURRENT
await env.EVENTS_DB.prepare(`
  INSERT INTO townhall_posts (
    id, user_id, title, prompt, created_at,
    r2_key, file_size, expires_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
  crypto.randomUUID(), userId, title, prompt,
  createdAt, r2Key, fileSize, expiresAt
).run();

// PROBLEM: Schema has city TEXT DEFAULT '' and state TEXT DEFAULT ''
// But these fields aren't populated, so they'll always be empty strings
// This is technically OK (defaults work), but limits functionality
```

**Impact**:
- ✅ Inserts will succeed (city/state have defaults)
- ⚠️ Town Hall threads won't have location data even if user provides it
- ⚠️ Can't filter/search by location later

**Fix**: Either:
- **Option A** (Accept defaults): Leave as-is for Phase 1; city/state remain null
- **Option B** (Populate from form): Ask Codex to add city/state fields to create-thread form and pass them through POST body
- **Option C** (Geo-locate): Infer from user's location in Firestore profile (harder)

**Recommendation**: **Option B (Populate from form)** - This is a Town Hall feature (citizens discussing issues in their area), so location makes sense. Codex should capture city/state in the form and pass them in the POST.

---

### 5. GET /api/townhall/posts Response Contract

**Current endpoint behavior** (after fixing bugs):
```javascript
GET /api/townhall/posts?limit=3&after=2025-12-09T12:00:00Z

Response:
{
  "results": [
    {
      "thread_id": "uuid",
      "title": "School Funding Bill Impact",
      "created_at": "2025-12-09T10:30:00Z",
      "county_name": null,           // ← Will be null (not in schema)
      "topic_slug": null,             // ← Will be null (not in schema)
      "user_id": "firebase-uid",
      "prompt": "Here's why this matters to me...",
      "file_url": "https://.../api/events/pdf/townhall-uuid.pdf" OR null,
      "file_size": 2048000,
      "expires_at": "2026-03-09T10:30:00Z"
    }
  ]
}
```

**Issues**:
- `county_name` and `topic_slug` should either be removed (if not used) or added to schema
- Response should include `city` and `state` (currently missing but exist in schema)

**Recommended shape** (fixed):
```javascript
{
  "results": [
    {
      "thread_id": "uuid",
      "title": "School Funding Bill Impact",
      "created_at": "2025-12-09T10:30:00Z",
      "user_id": "firebase-uid",
      "prompt": "Here's why this matters to me...",
      "city": "Cheyenne",
      "state": "Wyoming",
      "file_url": "https://.../api/events/pdf/townhall-uuid.pdf" OR null,
      "file_size": 2048000,
      "expires_at": "2026-03-09T10:30:00Z"
    }
  ]
}
```

---

## Recommended Changes (Priority Order)

### Priority 1: Fix Code Bugs (5 minutes)

**File**: `worker/src/townhall/listPosts.js`

Change:
```javascript
// OLD (lines 13, 26-27)
let query = `SELECT id, user_id, title, prompt, created_at, r2_key, file_size, expires_at
             FROM townhall_posts`;
...
      county_name: p.county_name || null,
      topic_slug: p.topic_slug || null,

// NEW
let query = `SELECT id, user_id, title, prompt, created_at, r2_key, file_size, expires_at, city, state
             FROM townhall_posts`;
...
      city: p.city || '',
      state: p.state || '',
```

**Impact**: Fixes silent null values; includes location data from schema.

---

### Priority 2: Update createPost to Capture city/state (10 minutes)

**File**: `worker/src/townhall/createPost.js`

Option 1: From form data (recommended)
```javascript
// NEW (add after line 13 - prompt capture)
const city      = form.get('city')?.trim() || '';
const state     = form.get('state')?.trim() || '';

// THEN update INSERT (lines 58-62)
await env.EVENTS_DB.prepare(`
  INSERT INTO townhall_posts (
    id, user_id, title, prompt, created_at,
    r2_key, file_size, expires_at, city, state
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
  crypto.randomUUID(), userId, title, prompt,
  createdAt, r2Key, fileSize, expiresAt, city, state
).run();
```

Option 2: From user profile (alternative, if Firestore user doc has location)
```javascript
// Get city/state from user's Firestore profile instead of form
```

**Impact**: Enables location-based thread filtering; enriches Town Hall data.

---

### Priority 3: Create Migration File (5 minutes)

**File**: `worker/migrations/0016_create_townhall_posts.sql`

```sql
-- Migration number: 0016  2025-12-09T12:00:00.000Z
-- Purpose: Create townhall_posts table for Town Hall threads
-- NOTE: This table already exists in production; migration ensures consistency
-- for local dev and new environments.

CREATE TABLE IF NOT EXISTS townhall_posts (
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
);

-- Optional: Create index for faster queries by created_at and city
CREATE INDEX IF NOT EXISTS idx_townhall_posts_created_at ON townhall_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_townhall_posts_city ON townhall_posts(city);
```

**Impact**: Ensures local dev has townhall_posts table; future environments will get it automatically.

---

## Summary: Current State vs. Codex Implementation Readiness

| Item | Status | Notes |
|------|--------|-------|
| **Table exists in production** | ✅ YES | Confirmed in d1_raw_output.txt |
| **Table schema correct** | ✅ YES | Matches documentation |
| **Migration file exists** | ❌ NO | Need to create 0016_create_townhall_posts.sql |
| **GET /api/townhall/posts** | ⚠️ BROKEN | Silent null values for county_name, topic_slug; missing city/state in response |
| **POST /api/townhall/create** | ⚠️ PARTIAL | Succeeds but doesn't capture city/state; relies on form defaults |
| **Firestore → D1 migration path** | ✅ READY | POST endpoint works; need to fix form handling |
| **Ready for Codex to update create-thread.js** | ✅ YES | After applying Priority 1 & 2 fixes |

---

## Actual vs. Documented: Snapshot Alignment

**Current snapshot** (`documentation/thisisus_snapshot_120625.md`):
- Lists townhall_posts table in passing (line 140)
- No detailed Town Hall API section
- No documented GET /api/townhall/posts endpoint

**Should be documented**:
- Town Hall table name: `townhall_posts`
- Key columns: id, user_id, title, prompt, city, state, created_at, file metadata
- GET endpoint: `/api/townhall/posts?limit=10&after=<ISO>`
- POST endpoint: `/api/townhall/create` (expects form data: title, prompt, city, state, file)
- Response shape (with city/state included)

**Snapshot fix**: Add Town Hall section with table definition and API spec (ready to paste below).

---

## Ready-to-Paste Snapshot Section

**Insert into** `documentation/thisisus_snapshot_120625.md` under the "Data Tables" section, after the EVENTS_DB description:

```markdown
## Town Hall Posts (EVENTS_DB)

**Table**: `townhall_posts`
- **Purpose**: Stores community discussions on civic topics (town hall threads initiated by citizens)
- **Columns**:
  - `id` (TEXT PRIMARY KEY): UUID; unique thread identifier
  - `user_id` (TEXT NOT NULL): Firebase UID of thread author
  - `title` (TEXT NOT NULL): Thread title (e.g., "School Funding Bill Impact on Our District")
  - `prompt` (TEXT): User's initial message/context for discussion
  - `created_at` (TEXT NOT NULL): ISO timestamp of thread creation
  - `city` (TEXT DEFAULT ''): City where the discussion originates
  - `state` (TEXT DEFAULT ''): State (defaults to Wyoming)
  - `r2_key` (TEXT): Reference to uploaded PDF/media in Cloudflare R2 (e.g., bill text, supporting document)
  - `file_size` (INTEGER): Byte size of uploaded file
  - `expires_at` (TEXT): ISO timestamp when file access expires (default: 90 days from creation)

### Town Hall APIs

**GET /api/townhall/posts**
- **Purpose**: List recent Town Hall threads
- **Query parameters**:
  - `limit` (integer, default 3, max 10): Number of threads to return
  - `after` (ISO timestamp, optional): Return only threads created before this date (pagination)
- **Response**:
  ```json
  {
    "results": [
      {
        "thread_id": "uuid",
        "title": "School Funding Bill Impact",
        "prompt": "Here's why this matters to me...",
        "user_id": "firebase-uid",
        "created_at": "2025-12-09T10:30:00Z",
        "city": "Cheyenne",
        "state": "Wyoming",
        "file_url": "https://this-is-us.org/api/events/pdf/townhall-uuid.pdf",
        "file_size": 2048000,
        "expires_at": "2026-03-09T10:30:00Z"
      }
    ]
  }
  ```
- **Status**: ✅ Functional
- **Auth**: None required (public read)

**POST /api/townhall/create**
- **Purpose**: Create a new Town Hall thread
- **Auth**: Requires Firebase ID token via Bearer header
- **Request** (form-data):
  - `title` (string, required): Thread title
  - `prompt` (string, optional): User's initial message
  - `city` (string, optional): City/location context
  - `state` (string, optional): State context
  - `file` (file, optional): Attached PDF/document (max 2 MB); auto-uploaded to R2
- **Response** (success):
  ```json
  { "success": true }
  ```
  - Status code: 201 Created
- **Response** (error):
  ```json
  { "error": "Missing title" | "File too large" | "Failed to create post" }
  ```
  - Status codes: 400 (bad request), 500 (server error)
- **Status**: ✅ Functional (after code fixes)
- **Auth**: ✅ Verified via Firebase token

**Notes**:
- Threads are public (no permission-based filtering on read)
- Files expire 90 days after creation; expired files are not served
- City/state enable location-based filtering for future UX enhancements
- Thread author can be inferred from `user_id`; deletion/editing not yet implemented
```

---

## Codex Implementation Checklist

When implementing Town Hall creation in create-thread.js, ensure:

- [ ] Form captures: `title` (required), `prompt` (optional), `city`, `state`, `file` (optional)
- [ ] POST to `/api/townhall/create` with Bearer token in Authorization header
- [ ] Handle response: 201 success, 400/500 errors
- [ ] Show error messages to user (file too large, missing title, etc.)
- [ ] GET /api/townhall/posts to fetch and display created threads
- [ ] Remove Firestore addDoc() call from create-thread.js
- [ ] Test with emulator: `firebase emulators:start` (if running locally)
- [ ] After implementation, run: `cd worker && ./scripts/wr d1 migrations apply EVENTS_DB --local`

---

## Commands for Jimmy (Local Dev Setup)

**Apply townhall_posts migration locally**:
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 migrations apply EVENTS_DB --local
```

**Verify table was created**:
```bash
./scripts/wr d1 execute EVENTS_DB --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='townhall_posts';"
```

**View schema of table**:
```bash
./scripts/wr d1 execute EVENTS_DB --local --command "PRAGMA table_info(townhall_posts);"
```

**Test GET /api/townhall/posts** (with ./scripts/wr dev running):
```bash
curl -s "http://127.0.0.1:8787/api/townhall/posts?limit=3" | jq
```

**Insert test row** (for debugging):
```bash
./scripts/wr d1 execute EVENTS_DB --local --command \
  "INSERT INTO townhall_posts (id, user_id, title, prompt, created_at, city, state) \
   VALUES ('test-uuid', 'test-uid', 'Test Thread', 'Test content', datetime('now'), 'Cheyenne', 'Wyoming');"
```

---

## Files to Modify

1. **Create**: `worker/migrations/0016_create_townhall_posts.sql` (new migration)
2. **Fix**: `worker/src/townhall/listPosts.js` (response bug)
3. **Fix**: `worker/src/townhall/createPost.js` (form capture)
4. **Update**: `documentation/thisisus_snapshot_120625.md` (add Town Hall section - ready to paste above)

---

## Status Summary for Handoff

✅ **Town Hall D1 infrastructure is ready for Codex implementation**

**What works**:
- Table exists and is correct
- POST /api/townhall/create endpoint exists
- GET /api/townhall/posts endpoint exists
- Firebase Auth middleware ready
- R2 file upload ready

**What needs fixing** (5 minutes of code changes):
- Remove county_name/topic_slug from response (not in schema)
- Add city/state to SELECT and response
- Capture city/state in createPost form
- Create migration file for repeatability

**What Codex needs to do**:
- Update create-thread.js to POST instead of Firestore addDoc
- Add city/state form fields
- Handle response codes
- Test with manual form submission

**Timeline**: Architecture ready now; code implementation ~1–2 hours for Codex.

