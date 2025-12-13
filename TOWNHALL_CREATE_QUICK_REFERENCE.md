# Town Hall Create Thread Design – Quick Reference

**Status**: ✅ Design Complete, Ready for Implementation  
**Codex Owner**: Frontend update + optional tests  
**Effort**: 5.5–7.5 hours total (1–2 core + 2–3 tests + 1–2 polish)

---

## TL;DR

**Problem**: `create-thread.js` writes to Firestore; security rules deny it.  
**Solution**: POST to `/api/townhall/create` (Worker endpoint) → writes to D1 instead.  
**Status**: Worker endpoint already exists. Just update frontend.

---

## Endpoint Specification

### POST /api/townhall/create

**Auth**: Bearer `<Firebase ID token>` in Authorization header

**Request** (JSON):
```json
{
  "title": "Natrona County Water Quality Discussion",
  "prompt": "Community feedback on tap water testing",
  "city": "Casper",
  "state": "WY"
}
```

**Response** (201 Created):
```json
{
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2025-12-08T14:32:10.123Z",
  "success": true
}
```

**Errors**:
- `400`: Missing title / File too large
- `401`: Unauthenticated (missing/invalid token)
- `500`: Database error

---

## Frontend Changes (create-thread.js)

### What to Remove
```javascript
// DELETE these imports:
import { getFirestore, collection, addDoc, serverTimestamp }
  from "...firebase-firestore.js";

// DELETE this code:
const db = getFirestore();
await addDoc(collection(db, "townhall_threads"), {
  title, body, location,
  createdBy: user.uid,
  timestamp: serverTimestamp(),
  replyCount: 0
});
```

### What to Add
```javascript
// KEEP this import:
import { getAuth } from "...firebase-auth.js";

// ADD this code in form submit handler:
const idToken = await user.getIdToken();

const response = await fetch("/api/townhall/create", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${idToken}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    title,
    prompt: body,           // Map "body" to "prompt"
    city: location          // Map "location" to "city"
  })
});

if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  const errorMsg = errorData.error || "Failed to create thread";
  return showMsg(`❌ ${errorMsg}`, "red");
}

const data = await response.json();
showMsg("✅ Thread published!", "green");
setTimeout(() => (location.href = "/townhall/"), 1000);
```

**Key changes**:
- ✅ Get ID token via `user.getIdToken()`
- ✅ POST to `/api/townhall/create`
- ✅ Send Bearer token in Authorization header
- ✅ Send JSON body (not Firestore write)
- ✅ Handle 201 success response
- ✅ Handle error responses (400, 401, 500)

---

## Worker Handler (Already Exists)

**File**: `worker/src/townhall/createPost.js`  
**Route**: `POST /api/townhall/create` (registered at `worker/src/index.mjs` line 90)

**Current behavior**:
- ✅ Verifies Firebase ID token via `requireAuth()`
- ✅ Validates required fields (title)
- ✅ Handles file uploads (optional, max 2 MB)
- ✅ Inserts into `EVENTS_DB.townhall_posts`
- ✅ Returns 201 on success

**Optional improvements** (not required):
- Add `city` and `state` to INSERT statement
- Return `thread_id` in 201 response (currently returns `{success: true}`)
- Add error codes for easier client-side debugging

---

## D1 Schema (Confirmed)

**Table**: `townhall_posts` in `EVENTS_DB`

```sql
CREATE TABLE IF NOT EXISTS townhall_posts (
  id TEXT PRIMARY KEY,              -- UUID
  user_id TEXT NOT NULL,            -- Firebase UID
  title TEXT NOT NULL,              -- Required
  prompt TEXT,                      -- Optional
  created_at TEXT NOT NULL,         -- Auto-generated
  r2_key TEXT,                      -- Optional PDF key
  file_size INTEGER,                -- Optional
  expires_at TEXT,                  -- Optional (90 days)
  city TEXT,                        -- Optional
  state TEXT                        -- Optional
);
```

**Field mapping**:
| Form | API JSON | D1 Column |
|------|----------|-----------|
| title | title | title |
| body | prompt | prompt |
| location | city | city |
| — | state | state |

---

## Jest Test Cases (Optional but Recommended)

### Worker Handler Tests (`tests/townhall/createPost.test.js`)
1. ✅ Happy path: valid token + body → 201 with thread_id
2. ✅ Validation: missing title → 400
3. ✅ Auth: invalid/missing token → 401
4. ✅ File: < 2 MB → 201 (stores in R2)
5. ✅ File: > 2 MB → 400
6. ✅ D1 error → 500

### Client Tests (`__tests__/townhall/createThread.test.js`)
1. ✅ Form validation: empty fields → show error
2. ✅ Auth check: not signed in → show error
3. ✅ Happy path: POST to /api/townhall/create with Bearer token
4. ✅ Error handling: 400, 401, 500 responses
5. ✅ Network error → show error
6. ✅ Redirect to /townhall/ on success

---

## Implementation Sequence

### Phase 1: Update Frontend (1–2 hours) 🔴 CRITICAL
1. Open `static/js/townhall/create-thread.js`
2. Remove Firestore imports and `const db = getFirestore()`
3. Replace Firestore `addDoc()` with Worker POST
4. Test in browser: form submission → redirect to /townhall/

### Phase 2: Test & Verify (1 hour) 🔴 CRITICAL
1. Create test thread via form
2. Verify thread appears in `/api/townhall/posts`
3. Verify thread appears in Civic Watch preview
4. Check Worker logs for any errors
5. Verify D1 record has correct fields

### Phase 3: Jest Tests (2–3 hours) 🟡 OPTIONAL
1. Create `tests/townhall/createPost.test.js` (6 test cases)
2. Create `__tests__/townhall/createThread.test.js` (6 test cases)
3. Run `npm test` and verify all pass

### Phase 4: Polish (1–2 hours) 🟢 OPTIONAL
1. Improve Worker handler (add error codes, return thread_id)
2. Update SNAPSHOT documentation
3. Review Firestore rules with Gemini

---

## Firestore Security Rules (Separate Task)

**Current state**: Firestore used for identity only.

**Proposed rules** (paste into Gemini for review):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own profile
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }

    // Deny all access to town hall (threads are in D1 now)
    match /townhall_threads/{document=**} {
      allow read, write: if false;
    }

    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Files to Modify

| File | Action | Priority |
|------|--------|----------|
| `static/js/townhall/create-thread.js` | Update: Firestore → Worker API | 🔴 CRITICAL |
| `tests/townhall/createPost.test.js` | Create: Worker handler tests | 🟡 Optional |
| `__tests__/townhall/createThread.test.js` | Create: Client integration tests | 🟡 Optional |
| `documentation/SNAPSHOT_120625_COMPREHENSIVE.md` | Update: Add POST endpoint spec | 🟢 Polish |
| `firestore.rules` | Review: Firestore rules (via Gemini) | 🟢 Polish |

---

## Effort Summary

| Task | Hours | Owner | Status |
|------|-------|-------|--------|
| Update `create-thread.js` | 1–2 | Codex | Ready |
| Test in browser | 1 | Codex | Depends on above |
| Add Jest tests | 2–3 | Codex | Optional |
| Improve Worker handler | 0.5 | Codex | Optional |
| Update docs | 1 | Codex | Optional |
| Firestore rules review | 0.5 | Codex + Gemini | Optional |
| **Total** | **5.5–7.5** | — | — |

**Critical path**: Update frontend (1–2 hours) + test (1 hour) = **2–3 hours to ship**

---

## Success Criteria

✅ User can submit "Create Thread" form without Firebase error  
✅ Thread is inserted into D1 `townhall_posts` table  
✅ Thread appears in `/api/townhall/posts` response  
✅ Thread appears in Civic Watch Town Hall preview  
✅ User is redirected to `/townhall/` on success  
✅ Error messages are shown for validation/auth/server errors  
✅ No Firestore writes in browser console  

---

## Architecture Diagram

```
┌──────────────────────────────────────┐
│  User Form (create-thread.js)        │ Static HTML form
├──────────────────────────────────────┤
│  1. Verify Firebase auth             │ auth.currentUser
│  2. Get ID token                     │ user.getIdToken()
│  3. POST to /api/townhall/create     │ with Authorization header
└──────────────────┬───────────────────┘
                   │ Authorization: Bearer <token>
                   │ Content-Type: application/json
                   │ { title, prompt, city, state }
                   ↓
┌──────────────────────────────────────┐
│  Cloudflare Worker (createPost.js)   │ POST /api/townhall/create
├──────────────────────────────────────┤
│  1. requireAuth() → verify token     │ Extract user_id from token
│  2. Validate body (title required)   │ Return 400 if invalid
│  3. Handle file upload (optional)    │ Store in R2 if present
│  4. Generate UUID + timestamp        │ Server-generated fields
└──────────────────┬───────────────────┘
                   │ INSERT INTO townhall_posts
                   │ (id, user_id, title, prompt, created_at, ...)
                   ↓
┌──────────────────────────────────────┐
│  D1 / EVENTS_DB                      │ Relational database
│  Table: townhall_posts               │ 10 columns
├──────────────────────────────────────┤
│  id, user_id, title, prompt,         │
│  created_at, r2_key, file_size,      │
│  expires_at, city, state             │
└──────────────────┬───────────────────┘
                   │ Return 201 with thread_id
                   ↓
┌──────────────────────────────────────┐
│  Frontend (Success)                  │
├──────────────────────────────────────┤
│  1. Show "✅ Thread published!"      │ Toast message
│  2. Redirect to /townhall/           │ 1 second delay
└──────────────────────────────────────┘
```

---

## Debugging Checklist

If the form still fails after updating:

1. **Check browser console** for JavaScript errors
2. **Check Network tab** for fetch request:
   - URL: `/api/townhall/create`
   - Method: `POST`
   - Headers: `Authorization: Bearer <token>`
   - Body: `{"title": "...", "prompt": "...", ...}`
3. **Check response status**:
   - 201 = success
   - 400 = validation error (check error message)
   - 401 = auth error (check token)
   - 500 = server error (check Worker logs)
4. **Check D1 directly**:
   ```bash
   wrangler d1 execute EVENTS_DB "SELECT * FROM townhall_posts ORDER BY created_at DESC LIMIT 5"
   ```
5. **Check Worker logs**:
   - Wrangler Dashboard → Logs → search for "create-thread" or error messages
   - Look for: `❌ Error creating post:` stack traces

---

## Next: Questions for Codex

1. Should `city` and `state` be required or optional in the POST body?
2. Should the frontend require the user to select a state from a dropdown?
3. Should we add client-side validation for `city` and `state` length?
4. Do you want to return `thread_id` in the 201 response (for redirects)?
5. Should we add rate limiting to prevent spam (X threads per user per hour)?

---

**Document**: TOWNHALL_CREATE_DESIGN.md (full spec) + this Quick Reference  
**Owner**: Codex (implementation)  
**Timeline**: 2–3 hours for critical path (frontend + test)
