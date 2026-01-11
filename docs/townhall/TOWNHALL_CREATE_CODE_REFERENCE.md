# create-thread.js – Before & After (Copy-Paste Ready)

**File**: `static/js/townhall/create-thread.js`  
**Change**: Firestore write → Worker API POST  
**Effort**: ~30 minutes for experienced developer

---

## BEFORE (Current – Broken)

```javascript
/* ─────────────────────────────────────────────────────────────
   File: static/js/townhall/create-thread.js
   Purpose: handle "Start a New Thread" form (Firebase v9)
   ──────────────────────────────────────────────────────────── */
console.log("🆕 create-thread.js loaded (v9)");

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

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
  const db   = getFirestore();

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

    /* write to Firestore ---------------------------------------------- */
    try {
      await addDoc(collection(db, "townhall_threads"), {
        title,
        body,
        location,
        createdBy : user.uid,
        timestamp : serverTimestamp(),
        replyCount: 0
      });

      showMsg("✅ Thread published!", "green");

      /* brief success pause, then back to landing */
      setTimeout(() => (location.href = "/townhall/"), 1000);
    } catch (err) {
      console.error("Error publishing thread:", err);
      showMsg("❌ Error publishing thread – try again.", "red");
    }
  });
});
```

**Problems**:
- ❌ Imports Firestore (not needed)
- ❌ Calls `addDoc()` to Firestore (permission denied)
- ❌ Uses `serverTimestamp()` (Firestore-specific)
- ❌ Writes to `"townhall_threads"` collection (not used)

---

## AFTER (Fixed – Worker API)

```javascript
/* ─────────────────────────────────────────────────────────────
   File: static/js/townhall/create-thread.js
   Purpose: Handle "Start a New Thread" form (Firebase v9 Auth + Worker API)
   ──────────────────────────────────────────────────────────── */
console.log("🆕 create-thread.js loaded (v9 + Worker API)");

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
      // Get Firebase ID token for authorization
      const idToken = await user.getIdToken();

      // Call Worker API to create thread in D1
      const response = await fetch("/api/townhall/create", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          prompt: body,    // API expects "prompt", form uses "body"
          city: location   // API expects "city", form uses "location"
          // state: "" – could add optional state selector
        })
      });

      // Handle response
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || "Failed to create thread";
        console.error(`❌ API Error (${response.status}):`, errorMsg);
        return showMsg(`❌ ${errorMsg}`, "red");
      }

      // Success
      const data = await response.json();
      console.log("✅ Thread created:", data);
      showMsg("✅ Thread published!", "green");

      /* brief success pause, then back to landing */
      setTimeout(() => (location.href = "/townhall/"), 1000);
    } catch (err) {
      console.error("❌ Network or parsing error:", err.message || err);
      showMsg("❌ Error publishing thread – try again.", "red");
    }
  });
});
```

**Improvements**:
- ✅ Only imports Firebase Auth (no Firestore)
- ✅ Calls Worker API `POST /api/townhall/create`
- ✅ Sends Firebase ID token via Bearer header
- ✅ Sends JSON body with `title`, `prompt`, `city`
- ✅ Handles 201 success response
- ✅ Handles 400, 401, 500 error responses
- ✅ Logs detailed errors to console
- ✅ Shows user-friendly error messages

---

## Key Changes Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Firestore import** | ✅ Yes | ❌ Removed |
| **`const db = getFirestore()`** | ✅ Yes | ❌ Removed |
| **`addDoc()` call** | ✅ Yes | ❌ Replaced with fetch |
| **Target collection** | `townhall_threads` | N/A (using API) |
| **Authentication** | Firebase Auth object | Firebase ID token |
| **Request type** | Firestore write | HTTP POST |
| **API endpoint** | N/A | `/api/townhall/create` |
| **Request body** | Firestore document | JSON object |
| **Response handling** | Firestore promise | HTTP response status |
| **Field mapping** | Direct (title, body, location) | Mapped (prompt, city) |
| **Error handling** | Firestore errors | HTTP status codes + error messages |

---

## Field Mapping Reference

When converting from Firestore to Worker API, use this mapping:

| Firestore Field | Worker API Field | D1 Column | Handling |
|-----------------|------------------|-----------|----------|
| `title` | `title` | `title` | Pass through as-is |
| `body` | `prompt` | `prompt` | Rename from "body" to "prompt" |
| `location` | `city` | `city` | Rename from "location" to "city" |
| `createdBy` (user.uid) | N/A | `user_id` | Auto-extracted from token by Worker |
| `timestamp` (serverTimestamp) | N/A | `created_at` | Auto-generated by Worker |
| `replyCount` | N/A | N/A | Not stored (future feature) |
| — | `state` | `state` | New optional field (could add) |

---

## Testing the Change

### Manual Test (In Browser)

1. **Clear browser cache** (or hard refresh: Ctrl+Shift+R)
2. **Navigate to** `/townhall/` or form page
3. **Open DevTools** (F12) → Console tab
4. **Fill form**:
   - Title: "Water Quality Discussion"
   - Location: "Casper"
   - Body: "Let's discuss tap water testing"
5. **Submit form**
6. **Check console**:
   - Should see: `✅ Thread created: {thread_id, created_at, ...}`
   - Should NOT see: Firestore errors
7. **Check response**:
   - Feedback: "✅ Thread published!"
   - After 1 second: Redirect to `/townhall/`
8. **Verify in D1**:
   ```bash
   ./scripts/wr d1 execute EVENTS_DB \
     "SELECT id, user_id, title, prompt, city, created_at FROM townhall_posts ORDER BY created_at DESC LIMIT 1"
   ```
   Should see your new thread with all fields populated

### Network Tab Test

1. **Open DevTools** → Network tab
2. **Submit form**
3. **Look for request** to `/api/townhall/create`
4. **Verify request**:
   - Method: `POST`
   - Headers: `Authorization: Bearer <token>`
   - Headers: `Content-Type: application/json`
   - Body: `{"title": "...", "prompt": "...", "city": "..."}`
5. **Verify response**:
   - Status: `201 Created`
   - Body: `{"thread_id": "...", "created_at": "...", "success": true}`

### Console Test

```javascript
// In browser console, you can test the fetch directly:

const auth = getAuth();
const user = auth.currentUser;
const token = await user.getIdToken();

const response = await fetch("/api/townhall/create", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    title: "Test Thread",
    prompt: "Test body",
    city: "Casper"
  })
});

const data = await response.json();
console.log(response.status, data);
// Should output: 201 {thread_id, created_at, success}
```

---

## Debugging if It Still Fails

### Error: "FirebaseError: Missing or insufficient permissions"
- **Cause**: Old Firestore code still running
- **Fix**: Clear cache, hard refresh (Ctrl+Shift+R), check you replaced the code correctly

### Error: "Failed to create thread" (500)
- **Cause**: Worker/D1 error
- **Fix**: Check Worker logs in Wrangler Dashboard
  ```bash
  ./scripts/wr logs --tail
  ```

### Error: "Unauthenticated" (401)
- **Cause**: Firebase token missing, invalid, or expired
- **Fix**:
  1. Verify user is signed in (`auth.currentUser` not null)
  2. Try signing out and back in
  3. Check that `user.getIdToken()` returns a non-empty string

### Error: "Missing title" (400)
- **Cause**: Form validation error
- **Fix**: Ensure form has `name="title"` and value is non-empty

### Thread created but doesn't appear in /api/townhall/posts
- **Cause**: D1 query filter or pagination issue
- **Fix**:
  1. Check D1 directly:
     ```bash
     ./scripts/wr d1 execute EVENTS_DB "SELECT COUNT(*) FROM townhall_posts"
     ```
  2. Check if thread has recent `created_at`:
     ```bash
     ./scripts/wr d1 execute EVENTS_DB \
       "SELECT * FROM townhall_posts WHERE title = 'Your Title'"
     ```
  3. Check `/api/townhall/posts` response limit:
     ```javascript
     fetch('/api/townhall/posts?limit=10').then(r => r.json()).then(console.log)
     ```

---

## Rollback Plan (If Needed)

If the new code has issues and you need to revert:

1. **Keep a backup** of the old code above
2. **Revert to original**:
   ```javascript
   import { getFirestore, collection, addDoc, serverTimestamp } from ...
   const db = getFirestore();
   await addDoc(collection(db, "townhall_threads"), { ... })
   ```
3. **But note**: Firestore will still deny writes (permission error)
4. **Long-term**: Worker API is the correct solution

---

## Performance Impact

- **Old way**: Client sends write directly to Firestore
  - Latency: ~50–100ms (depends on location)
  - Firestore rules evaluation: ~10ms
  - Result: Permission denied (no write)

- **New way**: Client POSTs to Worker, Worker writes to D1
  - Latency: ~100–200ms (extra hop through Worker, but consistent)
  - Auth verification: ~20ms (Firebase token validation)
  - D1 write: ~50ms
  - Result: Success (thread created)

**Conclusion**: Slightly slower (100–200ms vs 50–100ms), but works and is more secure.

---

## Validation Rules (Server-Side)

The Worker enforces:
- ✅ `title` required, non-empty, trimmed
- ✅ `prompt` optional, trimmed
- ✅ `city` optional, trimmed
- ✅ `state` optional, trimmed
- ✅ File optional, max 2 MB
- ✅ User must be authenticated (Bearer token valid)

The client should enforce (for better UX):
- ✅ Form validation before submit (non-empty required fields)
- ✅ Show loading indicator during fetch
- ✅ Show specific error messages (not generic "try again")
- ✅ Disable submit button during fetch (prevent double-submit)

---

## Optional Enhancements (Future)

1. **Show loading indicator** while POST is in flight
   ```javascript
   const submitBtn = form.querySelector('button[type="submit"]');
   submitBtn.disabled = true;
   submitBtn.textContent = "Publishing...";
   // Later: submitBtn.disabled = false; submitBtn.textContent = "Publish";
   ```

2. **Add state selector** instead of location input
   ```javascript
   body: JSON.stringify({
     title, prompt: body,
     state: form.querySelector('select[name="state"]').value,
     city: form.querySelector('input[name="city"]').value
   })
   ```

3. **Allow file attachment** (already supported by Worker)
   ```html
   <input type="file" name="file" accept=".pdf" />
   ```
   ```javascript
   const form = new FormData();
   form.append('title', title);
   form.append('prompt', body);
   form.append('file', form.querySelector('input[name="file"]').files[0]);
   const response = await fetch("/api/townhall/create", {
     method: "POST",
     headers: { "Authorization": `Bearer ${idToken}` },
     body: form  // FormData instead of JSON
   });
   ```

4. **Optimistic UI** – show thread immediately, then update from API
   ```javascript
   // Show thread before response comes back
   const newThreadId = crypto.randomUUID();
   renderThread({ id: newThreadId, title, prompt: body, ... });
   
   const response = await fetch("/api/townhall/create", { ... });
   const data = await response.json();
   updateThread(newThreadId, data); // Update with real thread_id and created_at
   ```

---

## Copy-Paste Checklist

- [ ] Delete lines 13–16 (Firestore imports)
- [ ] Delete line 28 (`const db = getFirestore();`)
- [ ] Replace lines 51–62 (Firestore addDoc section) with new fetch code
- [ ] Update console.log message (v9 → v9 + Worker API)
- [ ] Test in browser
- [ ] Check Network tab for POST request
- [ ] Check console for success message
- [ ] Verify thread appears in `/api/townhall/posts`
- [ ] Verify D1 record created

---

**Status**: Ready for copy-paste  
**Time**: ~30 minutes for experienced dev  
**Testing**: ~15 minutes in browser  
**Total**: ~45 minutes
