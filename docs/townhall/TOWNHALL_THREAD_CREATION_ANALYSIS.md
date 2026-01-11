# Town Hall Thread Creation Flow – Analysis Report

**Date**: December 8, 2025  
**Status**: 🔴 FAILING (Firestore blocked) → 🟢 FIX AVAILABLE (Worker ready)

---

## Executive Summary

The "create thread" feature is failing because the frontend tries to write directly to Firestore, but Firestore security rules correctly deny it. **The Worker endpoint to handle this already exists** (`POST /api/townhall/create`) and writes to D1. The fix is to update the frontend to use the Worker API instead of Firestore.

---

## Current Flow Analysis

### ❌ CREATE FLOW (Currently Fails)

**File**: `static/js/townhall/create-thread.js` (lines 45-61)

```javascript
// Current broken code:
const user = auth.currentUser;
if (!user) return showMsg("🔐 Please sign in first.", "red");

try {
  await addDoc(collection(db, "townhall_threads"), {
    title, body, location,
    createdBy: user.uid,
    timestamp: serverTimestamp(),
    replyCount: 0
  });
  showMsg("✅ Thread published!", "green");
} catch (err) {
  showMsg("❌ Error publishing thread – try again.", "red");  // ← Current error
}
```

**Problem**: Writes to Firestore collection `"townhall_threads"` but Firestore security rules deny client-side writes.

**Error**: `FirebaseError: Missing or insufficient permissions.`

**Root Cause**: Correct security posture (deny-by-default), but this is the *wrong path* for writes.

---

### ✅ READ FLOW (Currently Works)

**File**: `static/js/civic/watch.js` and `worker/src/townhall/listPosts.js`

```javascript
// Frontend (watch.js):
fetch(`${apiBase}/townhall/posts?limit=3`)

// Worker (listPosts.js):
const {results} = await env.EVENTS_DB
  .prepare(`SELECT id, user_id, title, prompt, created_at, r2_key, ...
           FROM townhall_posts ORDER BY created_at DESC LIMIT ?`)
  .bind(limit).all();

return {results: results.map(p => ({
  thread_id: p.id,
  title: p.title,
  created_at: p.created_at,
  ...
}))};
```

**Status**: ✅ Working correctly. Reads from D1 `townhall_posts` table via Worker API.

---

## Data Store Mapping

| Store | Purpose | Read | Write | Status |
|-------|---------|------|-------|--------|
| **Firestore "townhall_threads"** | Discussion threads | ❌ Not used | ❌ Blocked by rules | ❌ ORPHANED |
| **D1 "townhall_posts" (EVENTS_DB)** | Community submissions | ✅ Working (listPosts.js) | ✅ Ready (createPost.js) | ✅ READY |
| **Firebase Auth** | User authentication | ✅ Used for both | ✅ Verified by requireAuth() | ✅ WORKING |

---

## Root Cause Diagram

```
User creates thread
         ↓
create-thread.js (frontend)
         ↓
Tries: addDoc(collection(db, "townhall_threads"))
         ↓
Firestore security rules
         ↓
❌ DENIED (missing or insufficient permissions)
```

**Why it fails**: Firestore rules are locked down (good!), but this code path is wrong.

**Where it should go**:
```
User creates thread
         ↓
create-thread.js (frontend)
         ↓
POST /api/townhall/create (Worker endpoint)
         ↓
requireAuth() middleware (verifies Firebase token)
         ↓
env.EVENTS_DB.prepare(...INSERT...) (D1 write)
         ↓
✅ Thread saved to townhall_posts table
```

---

## Solution: Worker Endpoint Already Exists

**File**: `worker/src/townhall/createPost.js`

This handler is **already implemented** and ready to use:

```javascript
export async function handleCreateTownhallPost(request, env) {
  const identity = await requireAuth(request, env);
  const form = await request.formData();

  const userId = identity.uid;
  const title = form.get('title')?.trim();
  const prompt = form.get('prompt')?.trim();
  const file = form.get('file');

  // Validates, stores PDF in R2 if present
  // Writes to EVENTS_DB.townhall_posts

  await env.EVENTS_DB.prepare(`
    INSERT INTO townhall_posts (
      id, user_id, title, prompt, created_at, r2_key, file_size, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(...).run();

  return new Response(JSON.stringify({success: true}), {status: 201});
}
```

**Route**: `POST /api/townhall/create` (registered in `worker/src/index.mjs` line 90)

**Status**: ✅ Ready to receive requests

---

## Documentation vs Code Drift

### ✅ Good Alignment
- SNAPSHOT documents `townhall_posts` in D1 as source of truth
- Civic Watch correctly reads from `/api/townhall/posts` (D1-backed)
- Schema matches: `title`, `prompt`, `created_at`, `city`, `state`

### ⚠️ Minor Issues
- `listPosts.js` queries `county_name` and `topic_slug` from `townhall_posts`
- But these columns don't exist in the schema (`data/0001_create_townhall_posts.sql`)
- API returns `null` for these fields (harmless but indicates incomplete migration)

### ❌ Major Gap
- **SNAPSHOT doesn't document the CREATE endpoint** (`POST /api/townhall/create`)
- Firestore `"townhall_threads"` collection is mentioned nowhere in docs
- Thread **creation** flow is completely undocumented
- Only thread **reading** is documented

---

## Jest Test Coverage

### ✅ Existing Tests
- `__tests__/civic-watch.test.js` – Tests `renderTownhall()` function
- Verifies frontend renders town hall post titles and dates correctly
- Uses mock data shape: `{title, county_name, created_at, user_id, ...}`

### ❌ Missing Tests
- No tests for `POST /api/townhall/create` handler (createPost.js)
- No tests for `GET /api/townhall/posts` handler (listPosts.js)
- No tests for create flow (neither Firestore nor Worker path)
- No integration tests for full create→read cycle

---

## Implementation Checklist

### Phase 1: Fix Frontend (Update create-thread.js)

- [ ] Remove Firestore imports:
  ```javascript
  // REMOVE:
  import { getFirestore, collection, addDoc, serverTimestamp }
    from "...firebase-firestore.js";
  ```

- [ ] Replace Firestore write with Worker POST:
  ```javascript
  // REPLACE THIS:
  await addDoc(collection(db, "townhall_threads"), {
    title, body, location, createdBy: user.uid, ...
  });

  // WITH THIS:
  const formData = new FormData();
  formData.append('title', title);
  formData.append('prompt', body);  // Note: API expects "prompt", not "body"
  
  const res = await fetch('/api/townhall/create', {
    method: 'POST',
    body: formData,
    headers: {'Authorization': `Bearer ${await user.getIdToken()}`}
  });
  
  if (!res.ok) throw new Error('Failed to create thread');
  ```

### Phase 2: Update Documentation (SNAPSHOT)

- [ ] Add `POST /api/townhall/create` endpoint specification
- [ ] Document that `townhall_threads` (Firestore) is NOT used
- [ ] Clarify: All Town Hall data in D1 (both read and write)
- [ ] Add or remove `county_name` and `topic_slug` from schema

### Phase 3: Add Test Coverage

- [ ] Jest test for `POST /api/townhall/create` handler
- [ ] Test D1 insert, CORS headers, error handling
- [ ] Test `/api/townhall/posts` read with created data
- [ ] Integration test: create → read → verify in Civic Watch

### Phase 4: Verify

- [ ] Create thread form submits to Worker
- [ ] New thread appears in `/api/townhall/posts` response
- [ ] Civic Watch Town Hall preview card shows new thread
- [ ] No console errors

---

## Field Mapping (Frontend → API → D1)

| Frontend Form | API Field | D1 Column | Required |
|---------------|-----------|-----------|----------|
| `title` | `title` | `title` | ✅ Yes |
| `body` | `prompt` | `prompt` | ⚠️ Optional |
| `location` | *(removed)* | *(not stored)* | — |
| File upload | `file` | `r2_key` | ⚠️ Optional |
| — | *(auto)* | `id` (UUID) | ✅ Auto |
| — | *(auto)* | `user_id` (from auth) | ✅ Auto |
| — | *(auto)* | `created_at` (ISO timestamp) | ✅ Auto |

**Notes**:
- Frontend's `body` field maps to API's `prompt` field (not `body`)
- `location` is not currently stored (could add to D1 if needed)
- `file` upload stores PDF in R2 and references it as `r2_key`

---

## Security Considerations

✅ **Good**:
- Firestore rules deny client-side writes (correct)
- Worker endpoint requires Firebase token via `requireAuth()` middleware
- File uploads limited to 2MB
- User ID (`user.uid`) auto-populated from token (can't be spoofed)

⚠️ **To Verify**:
- CORS headers on Worker endpoint (should be restricted)
- HTTPS enforcement (should be required)
- Rate limiting (if needed to prevent spam)

---

## Data Flow After Fix

```
┌─────────────────────────────┐
│  create-thread.js (Frontend)│  User fills form & submits
└────────────┬────────────────┘
             │
             ↓
      POST /api/townhall/create
             │
             ↓
┌──────────────────────────────┐
│  createPost.js (Worker)      │  ✓ requireAuth() verification
│                              │  ✓ Validate title field
│                              │  ✓ Store PDF in R2
└────────────┬─────────────────┘
             │
             ↓
    EVENTS_DB.townhall_posts
    (D1 INSERT)
             │
             ├──────────────────────────┐
             │                          │
             ↓                          ↓
     User reads /civic/townhall/    Civic Watch previews
     (listPosts.js queries D1)      GET /api/townhall/posts
             │                          │
             └──────────────────────────┘
                        │
                        ↓
              Render Town Hall posts
```

---

## Summary for Chat

**Problem**: `create-thread.js` tries to write to Firestore but security rules deny it.

**Root Cause**: This is the *wrong* path. Thread creation should go through the Worker API, not Firestore.

**Solution**: Update `create-thread.js` to POST to `/api/townhall/create` instead of direct Firestore write.

**Status**: 
- ❌ Frontend form (broken, uses Firestore)
- ✅ Worker endpoint ready (`POST /api/townhall/create`)
- ✅ D1 table ready (`townhall_posts`)
- ✅ Auth middleware ready (`requireAuth()`)

**Next Step**: Migrate `create-thread.js` to use Worker API. All backend infrastructure is ready.

---

## Files Involved

| File | Purpose | Status |
|------|---------|--------|
| `static/js/townhall/create-thread.js` | Frontend form (BROKEN) | ❌ Needs update |
| `worker/src/townhall/createPost.js` | Handler for create (READY) | ✅ Ready |
| `worker/src/townhall/listPosts.js` | Handler for read (WORKING) | ✅ Working |
| `worker/src/index.mjs` | Route registration | ✅ Line 90 |
| `data/0001_create_townhall_posts.sql` | D1 schema | ✅ Applied |
| `documentation/SNAPSHOT_120625_COMPREHENSIVE.md` | Docs (INCOMPLETE) | ⚠️ Missing POST spec |
| `__tests__/civic-watch.test.js` | Frontend tests (LIMITED) | ⚠️ No handler tests |

---

**Created**: December 8, 2025  
**Status**: Analysis Complete – Ready for Implementation
