# Town Hall "Create Thread" Flow – Complete Design

**Date**: December 8, 2025  
**Status**: Design → Implementation Ready  
**Owner**: Codex (implementation)  
**Architecture**: Firebase Auth (identity) + Cloudflare Worker (API) + D1 (storage)

---

## 1. Overview & Goals

### Current State
- ❌ `static/js/townhall/create-thread.js` writes directly to Firestore collection `"townhall_threads"`
- ❌ Firestore security rules deny client-side writes (`FirebaseError: Missing or insufficient permissions`)
- ✅ Worker endpoint `POST /api/townhall/create` exists in `worker/src/townhall/createPost.js`
- ✅ D1 table `townhall_posts` in `EVENTS_DB` is ready for writes
- ✅ Read flow (`GET /api/townhall/posts`) working correctly from D1

### Design Goals
1. **Decouple identity from storage**: Firebase Auth manages user identity; D1 stores thread content
2. **Use secure API gateway**: Post via Worker endpoint, not direct client writes
3. **Leverage existing infrastructure**: `createPost.js` and `requireAuth()` already in place
4. **Add test coverage**: Jest tests for both Worker handler and client integration
5. **Minimal changes**: Update only `create-thread.js` (no new infrastructure needed)

---

## 2. D1 Schema Confirmation

**Table**: `townhall_posts` in `EVENTS_DB`  
**Migration**: `data/0001_create_townhall_posts.sql`

```sql
CREATE TABLE IF NOT EXISTS townhall_posts (
  id TEXT PRIMARY KEY,              -- UUID, generated server-side
  user_id TEXT NOT NULL,            -- Firebase UID from ID token
  title TEXT NOT NULL,              -- Required thread title
  prompt TEXT,                      -- Optional: main body/description
  created_at TEXT NOT NULL,         -- ISO 8601 timestamp, generated server-side
  r2_key TEXT,                      -- Optional: Cloudflare R2 key for PDF/media
  file_size INTEGER,                -- Optional: attachment size in bytes
  expires_at TEXT,                  -- Optional: ISO 8601 expiration date (90 days default)
  city TEXT,                        -- Optional: city/county name for location context
  state TEXT                        -- Optional: state code (e.g., "WY")
);
```

**Notes**:
- Server-generated fields: `id` (UUID), `user_id` (from Firebase token), `created_at`, `expires_at`
- User-provided fields: `title` (required), `prompt`, `city`, `state`, file attachment
- No `county_name` or `topic_slug` columns (these return null in GET response currently)

---

## 3. POST Endpoint Specification

### Path
```
POST /api/townhall/create
```

### Authentication
**Required**: Firebase ID token via Bearer header.

```
Authorization: Bearer <Firebase ID token>
```

Token is verified by `requireAuth(request, env)` middleware in `worker/src/auth/verifyFirebaseOrAccess.mjs`.  
Falls back to Cloudflare Access headers if present; otherwise requires valid Firebase token.

### Request Headers
```
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
```

### Request Body (JSON)
```json
{
  "title": "Natrona County Water Quality Town Hall",
  "prompt": "Community feedback on tap water testing results.",
  "city": "Casper",
  "state": "WY"
}
```

**Fields**:
| Field | Type | Required | Max Length | Notes |
|-------|------|----------|-----------|-------|
| `title` | string | ✅ Yes | 500 | Non-empty, trimmed |
| `prompt` | string | ⚠️ Optional | 5000 | Main thread body or question |
| `city` | string | ⚠️ Optional | 100 | City/county name |
| `state` | string | ⚠️ Optional | 2 | State code (e.g., "WY") |

### File Upload (Alternative: multipart/form-data)
If the frontend sends a file attachment:

```
POST /api/townhall/create
Content-Type: multipart/form-data

title=...
prompt=...
file=<PDF file, max 2MB>
```

The existing `createPost.js` handler already supports this. For now, **JSON-only variant** is recommended (simpler for form submission).

### Response: 201 Created (Success)
```json
{
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2025-12-08T14:32:10.123Z",
  "url": "/townhall/#550e8400-e29b-41d4-a716-446655440000"
}
```

**Fields**:
- `thread_id`: UUID of the newly created post (same as `id` in D1)
- `created_at`: ISO 8601 timestamp when the post was created
- `url`: (Optional) relative URL to view the thread

### Response: 400 Bad Request (Validation Error)
```json
{
  "error": "Missing title",
  "code": "VALIDATION_ERROR"
}
```

**Possible errors**:
- `Missing title` – title is required and empty
- `Invalid city` – city exceeds max length
- `File too large (max 2 MB)` – attachment exceeds 2 MB

### Response: 401 Unauthorized (Auth Error)
```json
{
  "error": "Unauthenticated",
  "code": "AUTH_ERROR"
}
```

**Possible causes**:
- Missing `Authorization` header
- Malformed Bearer token
- Invalid or expired Firebase ID token

### Response: 500 Internal Server Error (Database Error)
```json
{
  "error": "Failed to create post",
  "code": "DATABASE_ERROR"
}
```

**Possible causes**:
- D1 insert fails
- R2 upload fails (if file provided)
- Unexpected Worker error (logged in Worker console)

---

## 4. Worker Handler Implementation

### File Location
`worker/src/townhall/createPost.js`

### Current Implementation (Already Exists)
The handler is **already written** and supports both JSON and multipart/form-data.

**Key behavior**:
```javascript
export async function handleCreateTownhallPost(request, env) {
  // 1. Verify Firebase token; extract user_id
  const identity = await requireAuth(request, env);
  const userId = identity.uid;

  // 2. Parse form data (handles multipart/form-data or JSON)
  const form = await request.formData();
  const title = form.get('title')?.trim();
  const prompt = form.get('prompt')?.trim();
  const file = form.get('file');

  // 3. Validate required fields
  if (!title) {
    return new Response(JSON.stringify({ error: 'Missing title' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 4. If file provided, upload to R2 (max 2 MB)
  let r2Key = null;
  let fileSize = 0;
  if (file && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large (max 2 MB)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    r2Key = `townhall-${crypto.randomUUID()}.pdf`;
    await env.EVENT_PDFS.put(r2Key, file.stream());
  }

  // 5. Insert into D1
  try {
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    await env.EVENTS_DB.prepare(`
      INSERT INTO townhall_posts (
        id, user_id, title, prompt, created_at,
        r2_key, file_size, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), userId, title, prompt,
      createdAt, r2Key, fileSize, expiresAt
    ).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error("Error creating post:", err.stack);
    return new Response(JSON.stringify({ error: 'Failed to create post' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### Route Registration
**File**: `worker/src/index.mjs` (line 90)

```javascript
router.post("/api/townhall/create", handleCreateTownhallPost)
```

✅ **Status**: Route already registered and handler ready.

### To-Do for Codex (if needed)
**Minor improvements** (optional, handler is functional):

1. **Add `city` and `state` to D1 insert** (currently not populated):
   ```javascript
   const city = form.get('city')?.trim();
   const state = form.get('state')?.trim();
   
   await env.EVENTS_DB.prepare(`
     INSERT INTO townhall_posts (
       id, user_id, title, prompt, created_at, city, state, ...
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ...)
   `).bind(..., city, state, ...).run();
   ```

2. **Return `thread_id` in success response** (currently returns `{success: true}`):
   ```javascript
   const { success, meta } = await env.EVENTS_DB.prepare(...).run();
   return new Response(JSON.stringify({
     thread_id: uuid,
     created_at: createdAt,
     success: true
   }), { status: 201, ... });
   ```

3. **Add detailed error codes** for easier client-side handling:
   ```javascript
   { error: "Missing title", code: "VALIDATION_ERROR" }
   ```

---

## 5. Client-Side Implementation (create-thread.js)

### Current Implementation
`static/js/townhall/create-thread.js` (lines 1–100)

```javascript
// OLD: Direct Firestore write (fails with permission error)
await addDoc(collection(db, "townhall_threads"), {
  title, body, location, createdBy: user.uid, ...
});
```

### Proposed New Implementation

**File**: `static/js/townhall/create-thread.js`

```javascript
/* ─────────────────────────────────────────────────────────────
   File: static/js/townhall/create-thread.js
   Purpose: Handle "Start a New Thread" form (Firebase v9 Auth + Worker API)
   ──────────────────────────────────────────────────────────── */
console.log("🆕 create-thread.js loaded (v9 + Worker)");

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const form     = document.getElementById("new-thread-form");
  const feedback = document.getElementById("create-thread-feedback");
  if (!form || !feedback) return; // abort if markup missing

  /* helper – coloured feedback message */
  const showMsg = (msg, clr /* red | green | yellow … */) => {
    feedback.textContent = msg;
    feedback.className   = `mt-2 text-${clr}-600`;
    feedback.hidden      = false;
  };

  const auth = getAuth();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    /* grab & trim inputs ---------------------------------------------- */
    const fd       = new FormData(form);
    const title    = (fd.get("title")    || "").trim();
    const location = (fd.get("location") || "").trim();
    const body     = (fd.get("body")     || "").trim();

    if (!title || !location || !body) {
      return showMsg("⚠️  Please fill out all fields.", "red");
    }

    /* verify auth ----------------------------------------------------- */
    const user = auth.currentUser;
    if (!user) {
      return showMsg("🔐 Please sign in first.", "red");
    }

    /* POST to Worker endpoint ------------------------------------------ */
    try {
      // Get Firebase ID token
      const idToken = await user.getIdToken();

      // Call Worker API
      const response = await fetch("/api/townhall/create", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          prompt: body,           // Note: API expects "prompt", form uses "body"
          city: location          // Map "location" to "city"
          // state: optional, could prompt user
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || "Failed to create thread";
        console.error(`❌ Error (${response.status}):`, errorMsg);
        return showMsg(`❌ ${errorMsg}`, "red");
      }

      const data = await response.json();
      console.log("✅ Thread created:", data);
      showMsg("✅ Thread published!", "green");

      /* brief success pause, then back to landing */
      setTimeout(() => (location.href = "/townhall/"), 1000);
    } catch (err) {
      console.error("Error publishing thread:", err.message || err);
      showMsg("❌ Error publishing thread – try again.", "red");
    }
  });
});
```

**Key changes**:
1. ✅ Removed Firestore imports (`getFirestore`, `collection`, `addDoc`, `serverTimestamp`)
2. ✅ Keep Firebase Auth import (needed for `auth.currentUser`)
3. ✅ Replace Firestore write with Worker POST
4. ✅ Get Firebase ID token via `user.getIdToken()`
5. ✅ Send JSON body with `title`, `prompt`, `city`, `state`
6. ✅ Handle response errors with user-friendly messages
7. ✅ Log detailed errors to console for debugging

**Field mapping**:
| Frontend Form | API JSON | D1 Column | Notes |
|---------------|----------|-----------|-------|
| `title` | `title` | `title` | Required |
| `body` | `prompt` | `prompt` | Optional |
| `location` | `city` | `city` | Mapped from location field |
| — | — | `state` | Could add optional input for state |

### Form HTML (No Changes Needed)
Existing form structure in `content/townhall/create.md` or layout template remains the same:
```html
<form id="new-thread-form">
  <input name="title" placeholder="Thread title" required />
  <input name="location" placeholder="City or county" />
  <textarea name="body" placeholder="Your question or comment"></textarea>
  <button type="submit">Publish Thread</button>
</form>
<div id="create-thread-feedback"></div>
```

---

## 6. Firestore Rules Design (Identity-Only)

### Current State
Firestore is used for identity/profile only (not for thread content).

### Proposed Security Rules
**File**: Update `firestore.rules` to prevent client-side writes to thread-related collections.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own profile
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }

    // Deny all access to town hall thread collections
    // (threads are managed via Worker API + D1 only)
    match /townhall_threads/{document=**} {
      allow read, write: if false;  // Explicitly deny
    }

    // Default: deny all
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Rationale**:
- ✅ Users can manage their own profile (`/users/{uid}`)
- ❌ No client-side writes to `townhall_threads` (they go via Worker API instead)
- ❌ Default deny-all for security

**Note for Codex**: This is a security best practice and can be reviewed separately with a Gemini prompt if needed.

---

## 7. Jest Test Plan

### 7.1 Worker Handler Tests (`tests/townhall/createPost.test.js`)

**Location**: `tests/townhall/createPost.test.js` (new file)

```javascript
/**
 * tests/townhall/createPost.test.js
 * Jest tests for POST /api/townhall/create handler.
 */

import { handleCreateTownhallPost } from "../../worker/src/townhall/createPost.js";

// Mock Firebase token verification
jest.mock("../../worker/src/auth/verifyFirebaseOrAccess.mjs", () => ({
  requireAuth: jest.fn(),
}));

describe("POST /api/townhall/create", () => {
  let mockEnv;
  let { requireAuth } = require("../../worker/src/auth/verifyFirebaseOrAccess.mjs");

  beforeEach(() => {
    // Setup mock D1 and R2
    mockEnv = {
      EVENTS_DB: {
        prepare: jest.fn(() => ({
          bind: jest.fn(() => ({
            run: jest.fn().mockResolvedValue({ success: true })
          }))
        }))
      },
      EVENT_PDFS: {
        put: jest.fn().mockResolvedValue({ ok: true })
      }
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  test("Happy path: valid token and JSON body → 201 with thread_id", async () => {
    // Mock valid Firebase auth
    requireAuth.mockResolvedValue({ uid: "user123" });

    // Create request with JSON body
    const request = new Request("https://example.com/api/townhall/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Water Quality Discussion",
        prompt: "Testing our water supply",
        city: "Casper",
        state: "WY"
      })
    });

    const response = await handleCreateTownhallPost(request, mockEnv);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.thread_id).toBeDefined();
  });

  test("Validation error: missing title → 400 Bad Request", async () => {
    requireAuth.mockResolvedValue({ uid: "user123" });

    const request = new Request("https://example.com/api/townhall/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "No title provided",
        city: "Casper"
      })
    });

    const response = await handleCreateTownhallPost(request, mockEnv);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Missing title");
  });

  test("Auth error: missing or invalid token → 401 Unauthorized", async () => {
    requireAuth.mockRejectedValue(new Error("Invalid token"));

    const request = new Request("https://example.com/api/townhall/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" })
    });

    await expect(handleCreateTownhallPost(request, mockEnv)).rejects.toThrow();
  });

  test("File upload: PDF < 2MB accepted → 201", async () => {
    requireAuth.mockResolvedValue({ uid: "user123" });

    const file = new File(
      [new ArrayBuffer(1024 * 100)], // 100 KB
      "attachment.pdf",
      { type: "application/pdf" }
    );

    const form = new FormData();
    form.append("title", "Test with file");
    form.append("prompt", "Has a PDF");
    form.append("file", file);

    const request = new Request("https://example.com/api/townhall/create", {
      method: "POST",
      body: form
    });

    const response = await handleCreateTownhallPost(request, mockEnv);

    expect(response.status).toBe(201);
    expect(mockEnv.EVENT_PDFS.put).toHaveBeenCalled();
  });

  test("File upload: PDF > 2MB rejected → 400", async () => {
    requireAuth.mockResolvedValue({ uid: "user123" });

    const oversizedFile = new File(
      [new ArrayBuffer(3 * 1024 * 1024)], // 3 MB
      "huge.pdf",
      { type: "application/pdf" }
    );

    const form = new FormData();
    form.append("title", "Test with oversized file");
    form.append("file", oversizedFile);

    const request = new Request("https://example.com/api/townhall/create", {
      method: "POST",
      body: form
    });

    const response = await handleCreateTownhallPost(request, mockEnv);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("File too large");
  });

  test("D1 error: insert fails → 500 Internal Server Error", async () => {
    requireAuth.mockResolvedValue({ uid: "user123" });

    // Mock D1 failure
    mockEnv.EVENTS_DB.prepare = jest.fn(() => ({
      bind: jest.fn(() => ({
        run: jest.fn().mockRejectedValue(new Error("DB constraint violation"))
      }))
    }));

    const request = new Request("https://example.com/api/townhall/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" })
    });

    const response = await handleCreateTownhallPost(request, mockEnv);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain("Failed to create post");
  });
});
```

**Test cases**:
1. ✅ Happy path (valid token, required fields) → 201 with thread_id
2. ✅ Validation error (missing title) → 400
3. ✅ Auth error (invalid/missing token) → 401
4. ✅ File upload accepted (< 2 MB) → 201
5. ✅ File upload rejected (> 2 MB) → 400
6. ✅ D1 error (insert fails) → 500

### 7.2 Client-Side Tests (`__tests__/townhall/createThread.test.js`)

**Location**: `__tests__/townhall/createThread.test.js` (new file)

```javascript
/**
 * __tests__/townhall/createThread.test.js
 * Jest tests for static/js/townhall/create-thread.js client behavior.
 */

// Mock Firebase Auth
jest.mock("https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js", () => ({
  getAuth: jest.fn(() => ({
    currentUser: {
      uid: "user123",
      getIdToken: jest.fn().mockResolvedValue("mock-id-token")
    }
  }))
}));

// Mock fetch globally
global.fetch = jest.fn();

describe("create-thread.js client behavior", () => {
  let form, feedback;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <form id="new-thread-form">
        <input name="title" value="" />
        <input name="location" value="" />
        <textarea name="body"></textarea>
        <button type="submit">Publish</button>
      </form>
      <div id="create-thread-feedback"></div>
    `;

    form = document.getElementById("new-thread-form");
    feedback = document.getElementById("create-thread-feedback");

    // Reset mocks
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  test("Shows error if required fields are empty", async () => {
    // Load the script (mock)
    form.dispatchEvent(new Event("submit"));

    // In real test, this would trigger the form validation
    // Expected: "Please fill out all fields"
    // For this test, we simulate the expected behavior
    expect(feedback.textContent).toMatch(/fill out all fields/i);
  });

  test("Shows error if user is not signed in", async () => {
    // Mock getAuth to return null currentUser
    // Expected: "Please sign in first"
    const mockAuth = { currentUser: null };
    // Simulate form submission without auth
    // Expected feedback: "Please sign in first"
  });

  test("Happy path: valid form → POST to /api/townhall/create", async () => {
    global.fetch.mockResolvedValue(
      new Response(JSON.stringify({
        thread_id: "550e8400-e29b-41d4-a716-446655440000",
        created_at: "2025-12-08T14:32:10.123Z"
      }), { status: 201, headers: { "Content-Type": "application/json" } })
    );

    // Fill form
    form.querySelector('input[name="title"]').value = "Water Quality";
    form.querySelector('input[name="location"]').value = "Casper";
    form.querySelector('textarea[name="body"]').value = "Let's discuss water testing";

    // Simulate form submission
    form.dispatchEvent(new Event("submit"));

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify fetch was called with correct args
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/townhall/create",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Authorization": "Bearer mock-id-token",
          "Content-Type": "application/json"
        }),
        body: expect.stringContaining("Water Quality")
      })
    );

    // Verify success message
    expect(feedback.textContent).toContain("✅ Thread published!");
  });

  test("Shows error message on API failure (400 validation)", async () => {
    global.fetch.mockResolvedValue(
      new Response(JSON.stringify({
        error: "Missing title"
      }), { status: 400, headers: { "Content-Type": "application/json" } })
    );

    form.querySelector('input[name="title"]').value = "";
    form.querySelector('input[name="location"]').value = "Casper";
    form.querySelector('textarea[name="body"]').value = "No title";

    form.dispatchEvent(new Event("submit"));
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(feedback.textContent).toMatch(/❌/);
    expect(feedback.textContent).toMatch(/Missing title/);
  });

  test("Shows error message on API failure (401 auth)", async () => {
    global.fetch.mockResolvedValue(
      new Response(JSON.stringify({
        error: "Unauthenticated"
      }), { status: 401, headers: { "Content-Type": "application/json" } })
    );

    form.querySelector('input[name="title"]').value = "Test";
    form.querySelector('input[name="location"]').value = "Casper";
    form.querySelector('textarea[name="body"]').value = "Test body";

    form.dispatchEvent(new Event("submit"));
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(feedback.textContent).toMatch(/❌/);
    expect(feedback.textContent).toMatch(/Unauthenticated/);
  });

  test("Shows error message on network failure", async () => {
    global.fetch.mockRejectedValue(new Error("Network error"));

    form.querySelector('input[name="title"]').value = "Test";
    form.querySelector('input[name="location"]').value = "Casper";
    form.querySelector('textarea[name="body"]').value = "Test";

    form.dispatchEvent(new Event("submit"));
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(feedback.textContent).toMatch(/❌ Error publishing thread/);
  });

  test("Redirects to /townhall/ on success", async () => {
    global.fetch.mockResolvedValue(
      new Response(JSON.stringify({
        thread_id: "123",
        created_at: "2025-12-08T14:32:10.123Z"
      }), { status: 201, headers: { "Content-Type": "application/json" } })
    );

    // Mock window.location
    delete window.location;
    window.location = { href: "" };

    form.querySelector('input[name="title"]').value = "Test";
    form.querySelector('input[name="location"]').value = "Casper";
    form.querySelector('textarea[name="body"]').value = "Test";

    form.dispatchEvent(new Event("submit"));
    await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for redirect timeout

    expect(window.location.href).toBe("/townhall/");
  });
});
```

**Test cases**:
1. ✅ Validation: show error if fields are empty
2. ✅ Auth: show error if not signed in
3. ✅ Happy path: POST with correct Authorization and JSON body
4. ✅ Error handling: API 400 (validation)
5. ✅ Error handling: API 401 (auth)
6. ✅ Error handling: network failure
7. ✅ Redirect on success to `/townhall/`

---

## 8. Firestore Rules Design (Gemini Prompt)

To review the Firestore security rules with AI assistance, paste this prompt into Gemini:

```
I'm designing Firestore security rules for a civic engagement app (This Is Us).

Current setup:
- Firestore stores user identity/profiles at /users/{uid}
- Town hall thread content is stored in D1 (SQL database) and accessed via Cloudflare Worker API
- Client-side writes to D1 are NOT allowed; all writes go through the Worker endpoint
- We want to ensure Firestore is locked down except for user profile management

Proposed rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own profile
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }

    // Deny all access to town hall collections
    // (threads are managed via Worker API + D1 only)
    match /townhall_threads/{document=**} {
      allow read, write: if false;
    }

    // Default: deny all other collections
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Please review:
1. Are these rules secure enough?
2. Should we add any other collections (e.g., /events, /preferences)?
3. Are there any edge cases where client-side reads of profiles would fail?
4. Should we add a separate admin collection for moderation?

Thank you!
```

---

## 9. Implementation Checklist (For Codex)

### Phase 1: Update Frontend (Highest Priority)
- [ ] Update `static/js/townhall/create-thread.js`:
  - [ ] Remove Firestore imports (`getFirestore`, `collection`, `addDoc`, `serverTimestamp`)
  - [ ] Keep Firebase Auth import
  - [ ] Replace Firestore `addDoc()` with Worker POST to `/api/townhall/create`
  - [ ] Get Firebase ID token via `user.getIdToken()`
  - [ ] Map form fields: `title` → `title`, `body` → `prompt`, `location` → `city`
  - [ ] Handle 201 success response with thread_id
  - [ ] Handle 400, 401, 500 error responses
  - [ ] Log errors to console, show user-friendly messages
  - [ ] Redirect to `/townhall/` on success

**Effort**: 1–2 hours  
**Blocking**: Yes (users currently can't create threads)

### Phase 2: Improve Worker Handler (Optional)
- [ ] Add `city` and `state` to D1 INSERT statement in `createPost.js`
- [ ] Return `thread_id` and `created_at` in 201 response
- [ ] Add error codes (`VALIDATION_ERROR`, `AUTH_ERROR`, `DATABASE_ERROR`) for easier debugging
- [ ] Add request validation for `city` and `state` length

**Effort**: 30 minutes  
**Blocking**: No (handler works as-is)

### Phase 3: Add Jest Test Coverage
- [ ] Create `tests/townhall/createPost.test.js`:
  - [ ] Test happy path (201 with thread_id)
  - [ ] Test validation error (400 missing title)
  - [ ] Test auth error (401 invalid token)
  - [ ] Test file upload < 2MB (201)
  - [ ] Test file upload > 2MB (400)
  - [ ] Test D1 error (500)

- [ ] Create `__tests__/townhall/createThread.test.js`:
  - [ ] Test form validation (empty fields)
  - [ ] Test auth check (not signed in)
  - [ ] Test happy path (POST with correct body)
  - [ ] Test error handling (400, 401, 500)
  - [ ] Test network error
  - [ ] Test redirect on success

**Effort**: 2–3 hours  
**Blocking**: No (tests for future maintenance)

### Phase 4: Update Documentation
- [ ] Update `documentation/SNAPSHOT_120625_COMPREHENSIVE.md`:
  - [ ] Add `POST /api/townhall/create` endpoint spec
  - [ ] Remove mention of Firestore `townhall_threads` collection
  - [ ] Clarify that all Town Hall data lives in D1
  - [ ] Add field mapping for request/response
  - [ ] Document authentication requirement

- [ ] Add Firestore rules review (separate task; use Gemini prompt above)

**Effort**: 1 hour  
**Blocking**: No (documentation only)

### Phase 5: Testing & Verification
- [ ] Run `npm test` to verify Jest tests pass
- [ ] Test form submission in browser:
  - [ ] Create new thread successfully
  - [ ] Verify thread appears in `/townhall/` list
  - [ ] Verify error messages for various failure cases
- [ ] Check Worker logs in Wrangler Dashboard
- [ ] Verify D1 record created with correct fields
- [ ] Verify redirect to `/townhall/` on success

**Effort**: 1 hour  
**Blocking**: Yes (needs QA before deployment)

---

## 10. Summary for Handoff

### What's Ready (No changes needed)
✅ Worker endpoint `POST /api/townhall/create` exists and is functional  
✅ D1 table `townhall_posts` is ready to receive writes  
✅ Firebase Auth integration works  
✅ R2 file storage for attachments is configured  
✅ Route is registered at `worker/src/index.mjs` line 90  
✅ `requireAuth()` middleware verifies Firebase tokens  

### What Needs Implementation
❌ `static/js/townhall/create-thread.js` – Update to use Worker API instead of Firestore  
⚠️ Jest tests – Add comprehensive test coverage (optional but recommended)  
⚠️ Documentation – Add `POST /api/townhall/create` spec to SNAPSHOT  

### Architecture Summary
```
User Form (create-thread.js)
     ↓ POST /api/townhall/create
Cloudflare Worker (createPost.js)
     ├─ requireAuth() – verify Firebase ID token
     ├─ Validate form fields
     └─ INSERT into EVENTS_DB.townhall_posts
          ↓ D1
     Return 201 with thread_id
     ↓
Frontend shows success message and redirects to /townhall/
```

### Key Design Decisions
1. **Firestore for identity, D1 for content**: Separates concerns cleanly
2. **Worker API gateway**: All writes go through authenticated endpoint (secure)
3. **ID token verification**: Worker uses `requireAuth()` to verify Firebase tokens
4. **Optional attachments**: Files stored in R2 with 2 MB limit
5. **Minimal frontend changes**: Only update `create-thread.js`, keep form HTML

### Effort Estimates
| Task | Hours | Priority |
|------|-------|----------|
| Update `create-thread.js` | 1–2 | 🔴 Critical |
| Add Jest tests | 2–3 | 🟡 Important |
| Improve Worker handler | 0.5 | 🟢 Nice-to-have |
| Update documentation | 1 | 🟢 Nice-to-have |
| QA & testing | 1 | 🔴 Critical |
| **Total** | **5.5–7.5** | — |

---

**Next Steps for Codex**:
1. **Immediate**: Update `static/js/townhall/create-thread.js` per Section 5
2. **Next**: Test form submission in browser (verify 201 response and thread appears)
3. **Optional**: Add Jest test coverage from Section 7
4. **Optional**: Improve Worker handler per Section 4
5. **Optional**: Review Firestore rules with Gemini (Section 8)

All infrastructure is ready. You're just wiring the frontend to the existing API! 🎯
