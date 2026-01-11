# Town Hall Data Model & Tests Summary
## December 10, 2025

---

## 1. Final Town Hall D1 Schema

### townhall_posts (EVENTS_DB)

**Purpose**: Stores the initial thread/post for a Town Hall discussion.

**Columns**:
```
id              TEXT PRIMARY KEY        -- UUID for the thread
user_id         TEXT NOT NULL           -- Firebase UID of thread creator
title           TEXT NOT NULL           -- Thread title
prompt          TEXT                    -- Initial discussion prompt/body
created_at      TEXT NOT NULL           -- ISO 8601 timestamp
updated_at      TEXT                    -- ISO 8601 timestamp (when last edited)
r2_key          TEXT                    -- R2 bucket key for attached file (optional)
file_size       INTEGER                 -- Size of attached file in bytes
expires_at      TEXT                    -- ISO 8601 expiration time (90 days from creation)
city            TEXT DEFAULT ''         -- City where discussion takes place
state           TEXT DEFAULT ''         -- State (typically "WY")
county          TEXT                    -- County (NEW - links to WY_DB.verified_users)
```

**Indexes**:
```sql
idx_townhall_posts_created_at           -- For pagination/sorting
idx_townhall_posts_city                 -- For location filtering
idx_townhall_posts_county               -- For county-based filtering (NEW)
idx_townhall_posts_county_created_at    -- For county + chronological queries (NEW)
```

### townhall_replies (EVENTS_DB) - NEW

**Purpose**: Stores threaded conversations within a Town Hall thread.

**Columns**:
```
id                  INTEGER PRIMARY KEY AUTOINCREMENT  -- Sequential ID
thread_id           TEXT NOT NULL                      -- FK to townhall_posts.id
author_user_id      TEXT NOT NULL                      -- Firebase UID of reply author
author_voter_id     TEXT                               -- Voter ID (optional, for cross-reference)
body                TEXT NOT NULL                      -- Reply text content
created_at          TEXT NOT NULL                      -- ISO 8601 timestamp
updated_at          TEXT                               -- ISO 8601 timestamp (edits)
status              TEXT NOT NULL DEFAULT 'active'     -- 'active', 'hidden', 'deleted'
parent_reply_id     INTEGER                            -- FK to townhall_replies.id (for nested replies)
```

**Constraints**:
```sql
FOREIGN KEY (thread_id) REFERENCES townhall_posts(id) ON DELETE CASCADE
FOREIGN KEY (parent_reply_id) REFERENCES townhall_replies(id) ON DELETE CASCADE
```

**Indexes**:
```sql
idx_townhall_replies_thread_status      -- For listing active replies in a thread
idx_townhall_replies_author_user_id     -- For user reply history
idx_townhall_replies_parent             -- For nested reply chains
idx_townhall_replies_created_at         -- For chronological sorting
```

---

## 2. Authorization & Verification

### Gate for Creating Threads (POST /api/townhall/posts)

Verified voters (from WY_DB.verified_users):
- Must have an active user_id → voter_id link
- Must have status = 'verified'
- Required fields from verified_users used:
  - county (stored in townhall_posts for location tracking)
  - user_id (authenticated user)

**Rejection**: Non-verified users receive 403 with error: `not_verified`

### Gate for Creating Replies (POST /api/townhall/posts/:id/replies)

Same verification requirement as threads:
- Must be a verified voter
- author_user_id is derived from Firebase auth
- author_voter_id (optional) can be populated from verified_users.voter_id

**Note**: Future implementation may add county-based filtering (only allow verified voters in that county to reply).

---

## 3. Migrations Created

### Migration 0018: townhall_replies table
**File**: `worker/migrations/0018_create_townhall_replies.sql`

Creates the townhall_replies table with:
- Full schema as described above
- Comprehensive indexes for common queries
- Cascading delete constraints
- Default values for status and timestamps

### Migration 0019: Add county to townhall_posts
**File**: `worker/migrations/0019_add_county_to_townhall_posts.sql`

Adds county column to existing townhall_posts table:
- New TEXT column: county
- Indexes for county-based filtering
- Composite index for county + created_at queries
- Comment noting that county values come from WY_DB.verified_users

---

## 4. Jest Tests Created

### Test File: `worker/__tests__/townhall-posts-api.test.mjs`

Comprehensive integration tests for Town Hall endpoints using Jest with mocked D1 databases.

#### Test Suites:

**Suite 1: GET /api/townhall/posts (List Threads)**
- ✅ Returns empty list when no threads exist
- ✅ Returns list of threads with correct shape
- ✅ Respects limit parameter (max 10)
- ✅ Handles database errors gracefully

**Suite 2: POST /api/townhall/posts (Create Thread)**
- ✅ Creates thread successfully for verified voter
  - Verifies 201 status
  - Confirms thread_id, title, city, created_at in response
  - Thread created with verified user's Firebase UID
- ✅ Returns 403 for non-verified user
  - Error message: "not_verified"
  - Includes friendly message about verified voter requirement
- ✅ Returns 401 when not authenticated
- ✅ Validates required fields (title, prompt)
- ✅ Handles invalid JSON gracefully
- ✅ Sets default state to "WY" if not provided
- ✅ Handles database insertion errors (500)
- ✅ Rejects non-POST requests (405)

**Suite 3: Town Hall Authorization & Verification**
- ✅ Verified users from multiple counties can post
  - Tests Natrona, Albany, Laramie counties
  - Confirms each post succeeds with correct county
- ✅ Unverified status prevents posting
  - Tests pending/unconfirmed status returns 403

#### Mock Infrastructure:

**makeD1Mock()** - Simulates D1 database
- Configurable rows for townhall_posts, verified_users, replies
- Tracks inserted rows for verification
- Supports test failure scenarios (insertWillFail flag)
- Returns correct results based on SQL SELECT patterns

**makeEnv()** - Simulates Cloudflare Worker environment
- Configurable EVENTS_DB and WY_DB bindings
- Allows test-specific overrides
- Provides standard environment shape expected by handlers

#### Auth Mocking:

- requireAuth: Mocked to return Firebase UID
- getVerifiedUser: Mocked to return verified user data or null
- Allows testing both verified and non-verified paths

---

## 5. Test Execution

To run the new Town Hall API tests:

```bash
# Run only Town Hall tests
npm test -- worker/__tests__/townhall-posts-api.test.mjs

# Run all worker tests
npm test -- worker/__tests__/

# Run all tests (frontend + worker)
npm test
```

Expected output (when all tests pass):
```
PASS  worker/__tests__/townhall-posts-api.test.mjs
  GET /api/townhall/posts
    ✓ returns empty list when no threads exist (XX ms)
    ✓ returns list of threads with correct shape (XX ms)
    ✓ respects limit parameter (max 10) (XX ms)
    ✓ handles database error gracefully (XX ms)
  POST /api/townhall/posts
    ✓ creates thread successfully for verified voter (XX ms)
    ✓ returns 403 for non-verified user (XX ms)
    ✓ returns 401 when not authenticated (XX ms)
    ✓ validates required fields (XX ms)
    ✓ handles invalid JSON gracefully (XX ms)
    ✓ sets default state to WY if not provided (XX ms)
    ✓ handles database insertion errors (XX ms)
    ✓ rejects non-POST requests (XX ms)
  Town Hall Authorization & Verification
    ✓ verified users from multiple counties can post (XX ms)
    ✓ unverified status prevents posting (XX ms)

Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

---

## 6. Snapshot Alignment

The updated `snapshot_12-10-25.md` should reference:

**Data Model Section (2.4)**:
```
### 2.4 Town Hall tables
- townhall_posts (EVENTS_DB): id (UUID), user_id, title, prompt, created_at, city, state, county
  - Schema updated in migration 0016; county added in migration 0019
  - Indexed for pagination and location filtering
- townhall_replies (EVENTS_DB): id, thread_id, author_user_id, body, created_at, status, parent_reply_id
  - Enables threaded conversations within Town Hall discussions
  - Cascading delete; supports nested replies
  - Indexed for efficient thread/author queries
- Town Hall posting requires verified_users authorization (see section 3)
```

**Auth & Verification Section (3)**:
```
- Town Hall posting now requires verified_users authorization
  - User must have status = 'verified' in WY_DB.verified_users
  - user_id auto-derived from Firebase auth
  - county populated from verified_users for location tracking
  - Non-verified users receive 403 with error: 'not_verified'
```

---

## 7. Future Enhancements

### Planned but not yet implemented:

1. **Reply endpoints** - POST /api/townhall/posts/:id/replies
   - Implementation ready; tests written; route not yet wired

2. **County-level gating** - Restrict replies to verified voters in that county
   - Schema supports; logic to be added in route handlers

3. **Reply moderation** - Hide/delete inappropriate replies
   - Status column supports ('active', 'hidden', 'deleted')
   - Moderation UI/API not yet implemented

4. **Reply notifications** - Notify thread creator of new replies
   - Would require email/Firestore integration
   - Schema supports; event handlers not yet added

5. **Search & filtering** - Find threads by title, content, county
   - Indexes ready; API endpoints not yet created

---

## 8. Deployment Checklist

- [ ] Run migrations in local: `./scripts/wr d1 execute EVENTS_DB --file worker/migrations/0018_create_townhall_replies.sql`
- [ ] Run migrations in preview: `./scripts/wr d1 execute EVENTS_DB --env preview --file worker/migrations/0018_create_townhall_replies.sql`
- [ ] Run migrations in production: `./scripts/wr d1 execute EVENTS_DB --env production --file worker/migrations/0018_create_townhall_replies.sql`
- [ ] Repeat for migration 0019
- [ ] Run tests locally: `npm test -- worker/__tests__/townhall-posts-api.test.mjs`
- [ ] Verify no test failures
- [ ] Deploy worker code with new tests

---

**Status**: ✅ Schema finalized, migrations created, comprehensive tests written and verified for syntax.
**Next**: Implement reply endpoints and integrate county-level authorization as needed.
