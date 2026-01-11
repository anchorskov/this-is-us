# Verified Voter Bridge Table Implementation

## Overview

This implementation introduces a **verified_users** bridge table in D1 (Wyoming voter database) to gate Town Hall posting and voting to verified county voters. Verification is a one-time check, then a fast D1 lookup on subsequent operations.

## Architecture

```
Firebase Auth (uid)
    ↓
Town Hall POST Request (create thread / comment)
    ↓
requireAuth(request, env) → identity.uid
    ↓
getVerifiedUser(env, uid) → checks D1 verified_users table
    ↓
If verified: Insert into EVENTS_DB townhall_posts ✓
If not verified: Return 403 ✗
    ↓
Read operations (listPosts) → No verification required
```

## Files Modified/Created

### 1. Migration File
**File**: `worker/migrations_wy/0018_create_verified_users.sql`

Creates the `verified_users` bridge table with:
- `user_id` TEXT PRIMARY KEY (Firebase UID)
- `voter_id` TEXT NOT NULL UNIQUE (links to voters_addr_norm)
- `county` TEXT (optional, cached for quick checks)
- `house` TEXT (optional, cached House district)
- `senate` TEXT (optional, cached Senate district)
- `verified_at` TEXT NOT NULL (ISO timestamp)
- `status` TEXT NOT NULL DEFAULT 'verified' (allows future revocation)
- Indexes on `voter_id`, `status`, and composite `(user_id, status)`

**Apply with**:
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 execute WY_DB --file migrations_wy/0018_create_verified_users.sql
```

### 2. Helper Module
**File**: `worker/src/townhall/verifiedUserHelper.mjs`

Exports:
- `getVerifiedUser(env, userId)` - Fetch verified user record
- `createVerifiedUser(env, userId, voterId, voterInfo)` - Create verified record after voter verification
- `revokeVerifiedUser(env, userId)` - Revoke verified status

```javascript
import { getVerifiedUser } from "./verifiedUserHelper.mjs";

const verified = await getVerifiedUser(env, uid);
if (!verified) {
  return response(403, { error: "not_verified", ... });
}
```

### 3. Modified Town Hall Routes

#### `worker/src/townhall/createThread.mjs`
**Changes**: Added verification check before thread creation

```javascript
// NEW: Import helper
import { getVerifiedUser } from "./verifiedUserHelper.mjs";

// In handleCreateTownhallThread(), after requireAuth():
const verifiedUser = await getVerifiedUser(env, identity.uid);
if (!verifiedUser) {
  return new Response(
    JSON.stringify({
      error: "not_verified",
      message: "Verified county voter account required to create Town Hall threads.",
    }),
    { status: 403, headers: OK_HEADERS }
  );
}
```

#### `worker/src/townhall/createPost.js`
**Changes**: Added verification check before comment creation

```javascript
// NEW: Import helper
import { getVerifiedUser } from "./verifiedUserHelper.mjs";

// In handleCreateTownhallPost(), after requireAuth():
const verifiedUser = await getVerifiedUser(env, identity.uid);
if (!verifiedUser) {
  return withRestrictedCORS(
    JSON.stringify({
      error: "not_verified",
      message: "Verified county voter account required to post in Town Hall.",
    }),
    403,
    { 'Content-Type': 'application/json' },
    request,
    TOWNHALL_ALLOWED_ORIGINS
  );
}
```

#### `worker/src/townhall/deletePost.js`
**Changes**: None required (already enforces ownership check, can be self-delete or admin delete)

#### `worker/src/townhall/listPosts.js`
**Changes**: None required (read-only, public endpoint)

### 4. Test File
**File**: `worker/test/townhall.verified.test.mjs`

Jest tests covering:
- ✓ `getVerifiedUser` returns verified record
- ✓ `getVerifiedUser` returns null for unverified user
- ✓ `getVerifiedUser` handles database errors gracefully
- ✓ `createVerifiedUser` successfully creates record
- ✓ `handleCreateTownhallThread` allows verified users (201)
- ✓ `handleCreateTownhallThread` rejects unverified users (403)
- ✓ `handleCreateTownhallThread` rejects unauthenticated requests (401)

## Behavior Changes

### Before
- Any authenticated Firebase user could POST to Town Hall
- No county or voter validation

### After
- Only users with a record in `verified_users` table can POST
- Verification status is checked on EVERY POST/THREAD creation
- County/house/senate info is cached for quick lookups
- Users can be revoked by setting status = 'revoked'

### Error Responses

**403 Verified Required**
```json
{
  "error": "not_verified",
  "message": "Verified county voter account required to create Town Hall threads."
}
```

**401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "details": "<auth error message>"
}
```

## Database Queries

### Create verified user after voter verification
```sql
INSERT INTO verified_users (
  user_id,
  voter_id,
  county,
  house,
  senate,
  verified_at,
  status
)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'verified');
```

### Check if user is verified (fast lookup)
```sql
SELECT
  user_id,
  voter_id,
  county,
  house,
  senate,
  verified_at,
  status
FROM verified_users
WHERE user_id = ?1 AND status = 'verified'
LIMIT 1;
```

### Revoke verified status
```sql
UPDATE verified_users
SET status = 'revoked'
WHERE user_id = ?1;
```

### Count verified users by county
```sql
SELECT county, COUNT(*) as count
FROM verified_users
WHERE status = 'verified'
GROUP BY county;
```

## Integration with Voter Verification Flow

When a user verifies their voter registration (e.g., via `/api/verify-voter`):

1. **Voter verification route** validates against `voters_addr_norm`
2. **On success**, call `createVerifiedUser()`:
   ```javascript
   const success = await createVerifiedUser(env, uid, voter_id, {
     county: voterRecord.county,
     house: voterRecord.house,
     senate: voterRecord.senate
   });
   ```
3. **User can now POST** to Town Hall

## Manual Testing / curl Examples

### 1. Create verified user record (after voter verification)
```bash
# This would normally be called from your voter verification endpoint
# For manual testing via DB shell:
sqlite3 d1.db << 'EOF'
INSERT INTO verified_users (
  user_id,
  voter_id,
  county,
  house,
  senate,
  verified_at,
  status
)
VALUES (
  'firebase-uid-123',
  'voter-id-456',
  'LARAMIE',
  '022',
  '001',
  datetime('now', 'utc'),
  'verified'
);
EOF
```

### 2. Create Town Hall thread (verified user)
```bash
curl -X POST https://api.this-is-us.org/api/townhall/posts \
  -H "Authorization: Bearer <valid-firebase-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Downtown Laramie Development",
    "prompt": "What should we prioritize in downtown revitalization?",
    "city": "LARAMIE",
    "state": "WY"
  }'

# Expected: 201 Created
# { "thread_id": "uuid", "created_at": "2025-12-09T..." }
```

### 3. Create Town Hall thread (unverified user)
```bash
curl -X POST https://api.this-is-us.org/api/townhall/posts \
  -H "Authorization: Bearer <unverified-firebase-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Thread",
    "prompt": "Test",
    "city": "LARAMIE"
  }'

# Expected: 403 Forbidden
# {
#   "error": "not_verified",
#   "message": "Verified county voter account required to create Town Hall threads."
# }
```

### 4. Read Town Hall threads (no auth required)
```bash
curl -X GET "https://api.this-is-us.org/api/townhall/posts?limit=10"

# Expected: 200 OK
# { "results": [...] }
```

### 5. Check verified status in D1 (direct query)
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 execute WY_DB --command "SELECT COUNT(*) FROM verified_users WHERE status = 'verified';"
```

### 6. Revoke verified user
```bash
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 execute WY_DB --command "UPDATE verified_users SET status = 'revoked' WHERE user_id = 'firebase-uid-123';"
```

## Non-Breaking Behavior

✓ **Read-only routes** (listPosts, getThread) remain **public** - no auth required
✓ **Existing voters_addr_norm schema** unchanged
✓ **Town Hall storage** remains in D1 (EVENTS_DB)
✓ **User profiles/preferences** remain in Firestore
✓ **Delete operations** still use ownership check (users can delete own posts)

## Future Enhancements

1. **County-scoped posting**: Enforce `verified.county == request.city`
2. **Audit trail**: Log all verification/revocation events
3. **Batch verification**: Accept CSV upload of verified voters
4. **Status page**: Show verification count by county
5. **Expiring verification**: Add `expires_at` field for periodic re-verification

## File Locations Summary

| File | Purpose |
|------|---------|
| `worker/migrations_wy/0018_create_verified_users.sql` | D1 migration - creates verified_users table |
| `worker/src/townhall/verifiedUserHelper.mjs` | Helper functions for verification checks |
| `worker/src/townhall/createThread.mjs` | Updated - adds verification check |
| `worker/src/townhall/createPost.js` | Updated - adds verification check |
| `worker/src/townhall/deletePost.js` | Unchanged - already has ownership check |
| `worker/src/townhall/listPosts.js` | Unchanged - read-only, public |
| `worker/test/townhall.verified.test.mjs` | Jest tests for verified voter gating |

## Deployment Checklist

- [ ] Apply migration: `./scripts/wr d1 execute WY_DB --file migrations_wy/0018_create_verified_users.sql`
- [ ] Review updated createThread.mjs changes
- [ ] Review updated createPost.js changes
- [ ] Run tests: `npm test worker/test/townhall.verified.test.mjs`
- [ ] Manual test: Create verified user record and test 201/403 responses
- [ ] Monitor: Check logs for "not_verified" rejections
- [ ] Communicate: Notify users that Town Hall posting now requires verification

