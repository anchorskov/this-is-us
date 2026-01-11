# Town Hall Migrations - Quick Reference

## Migration 0018: Create townhall_replies table

**File**: `worker/migrations/0018_create_townhall_replies.sql`

```sql
-- Migration number: 0018 	 2025-12-10T14:00:00.000Z
-- Purpose: Create townhall_replies table for Town Hall thread conversations
-- Enables nested discussions within Town Hall threads posted by verified voters

CREATE TABLE IF NOT EXISTS townhall_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  author_voter_id TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  parent_reply_id INTEGER,

  FOREIGN KEY (thread_id) REFERENCES townhall_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_reply_id) REFERENCES townhall_replies(id) ON DELETE CASCADE
);

-- Index for efficient thread reply listing with status filtering
CREATE INDEX IF NOT EXISTS idx_townhall_replies_thread_status
  ON townhall_replies(thread_id, status)
  WHERE status = 'active';

-- Index for author history (view all replies by a user)
CREATE INDEX IF NOT EXISTS idx_townhall_replies_author_user_id
  ON townhall_replies(author_user_id);

-- Index for nested reply chains (find parent-child relationships)
CREATE INDEX IF NOT EXISTS idx_townhall_replies_parent
  ON townhall_replies(parent_reply_id)
  WHERE parent_reply_id IS NOT NULL;

-- Index for chronological sorting (most recent first)
CREATE INDEX IF NOT EXISTS idx_townhall_replies_created_at
  ON townhall_replies(created_at DESC);
```

---

## Migration 0019: Add county to townhall_posts

**File**: `worker/migrations/0019_add_county_to_townhall_posts.sql`

```sql
-- Migration number: 0019 	 2025-12-10T14:05:00.000Z
-- Purpose: Add county column to townhall_posts for better location tracking
-- Enables county-level filtering and linking to WY_DB.verified_users for verification

ALTER TABLE townhall_posts ADD COLUMN county TEXT;

-- Index for county-based filtering and potential county-level town halls
CREATE INDEX IF NOT EXISTS idx_townhall_posts_county
  ON townhall_posts(county);

-- Composite index for common filtering pattern: county + status (if status added later)
CREATE INDEX IF NOT EXISTS idx_townhall_posts_county_created_at
  ON townhall_posts(county, created_at DESC);
```

---

## Summary of Schema Changes

### townhall_posts (EVENTS_DB)

**Before** (migration 0016):
```
id TEXT PRIMARY KEY
user_id TEXT NOT NULL
title TEXT NOT NULL
prompt TEXT
created_at TEXT NOT NULL
r2_key TEXT
file_size INTEGER
expires_at TEXT
city TEXT DEFAULT ''
state TEXT DEFAULT ''
```

**After** (migration 0019 applied):
```
id TEXT PRIMARY KEY
user_id TEXT NOT NULL
title TEXT NOT NULL
prompt TEXT
created_at TEXT NOT NULL
r2_key TEXT
file_size INTEGER
expires_at TEXT
city TEXT DEFAULT ''
state TEXT DEFAULT ''
county TEXT                         ← NEW (migration 0019)
```

### townhall_replies (EVENTS_DB) - NEW TABLE

```
id INTEGER PRIMARY KEY AUTOINCREMENT
thread_id TEXT NOT NULL                    ← FK to townhall_posts
author_user_id TEXT NOT NULL               ← Firebase UID
author_voter_id TEXT                       ← Optional voter link
body TEXT NOT NULL
created_at TEXT NOT NULL
updated_at TEXT
status TEXT NOT NULL DEFAULT 'active'
parent_reply_id INTEGER                    ← FK to self (nested replies)
```

---

## How to Apply Migrations

### Local Development

```bash
# Apply migration 0018
./scripts/wr d1 execute EVENTS_DB --file worker/migrations/0018_create_townhall_replies.sql

# Apply migration 0019
./scripts/wr d1 execute EVENTS_DB --file worker/migrations/0019_add_county_to_townhall_posts.sql
```

### Preview Environment

```bash
./scripts/wr d1 execute EVENTS_DB --env preview --file worker/migrations/0018_create_townhall_replies.sql
./scripts/wr d1 execute EVENTS_DB --env preview --file worker/migrations/0019_add_county_to_townhall_posts.sql
```

### Production Environment

```bash
./scripts/wr d1 execute EVENTS_DB --env production --file worker/migrations/0018_create_townhall_replies.sql
./scripts/wr d1 execute EVENTS_DB --env production --file worker/migrations/0019_add_county_to_townhall_posts.sql
```

---

## Files Created/Modified

1. ✅ **NEW**: `worker/migrations/0018_create_townhall_replies.sql`
2. ✅ **NEW**: `worker/migrations/0019_add_county_to_townhall_posts.sql`
3. ✅ **NEW**: `worker/__tests__/townhall-posts-api.test.mjs` (comprehensive API tests)
4. ✅ **REFERENCE**: `TOWNHALL_DATA_MODEL_TESTS.md` (full documentation)

---

## Test Coverage

The new test file `worker/__tests__/townhall-posts-api.test.mjs` includes:

- **GET /api/townhall/posts**: 4 tests
- **POST /api/townhall/posts**: 9 tests  
- **Authorization & Verification**: 2 tests
- **Total**: 15 tests covering:
  - Empty lists
  - Thread listing with pagination
  - Thread creation for verified voters
  - Rejection of non-verified users
  - Field validation
  - JSON parsing errors
  - Database failures
  - Multi-county scenario testing

Run with: `npm test -- worker/__tests__/townhall-posts-api.test.mjs`
