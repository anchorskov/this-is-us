# Firestore Security Rules Review – Analysis & Recommendations

**Date**: December 8, 2025  
**Status**: Analysis complete, revised rules ready  
**Architecture**: Firestore = identity/profile only; D1 = all civic content

---

## 1. Current Firestore Usage Mapping

### Collections Found in Code

#### ✅ **users/{uid}** – User Profiles (REQUIRED)
**Usage**: Identity and user profile data  
**Files**:
- `static/js/firebase-session.js` (lines 70): Creates user profile on signup
- `static/js/account.js` (line 150): Updates user profile (displayName, city, state, newsletter)
**Operations**:
- ✅ READ: Users read their own `users/{uid}` doc
- ✅ WRITE: Users write/update their own `users/{uid}` doc
**Current Rules**: Allowed (correct)

#### ⚠️ **townhall_threads/{threadId}** – Thread Content (LEGACY/MOVING)
**Usage**: Was used for thread content (now moving to D1 + Worker API)  
**Files**:
- `static/js/townhall/create-thread.js`: Creates threads (will be updated to use Worker)
- `static/js/townhall/home.js`: Reads threads (for UI display)
- `static/js/townhall/threads.js`: Reads/lists threads
- `static/js/townhall/map.js`: Reads threads with onSnapshot
- `static/js/townhall/threads-inline.js` (line 40): Reads threads, also adds replies
**Operations**:
- ✅ READ: Public read access (no auth required)
- ❌ WRITE: Creates/updates/deletes (currently allowed, should be denied)
- ❌ REPLIES: Nested replies collection with write access
**Current Rules**: Too permissive (allows public writes if verified)
**Migration**: Moving to D1; writes should be blocked

#### ⚠️ **townhall_posts/{postId}** – Alternative Thread Collection (LEGACY)
**Usage**: Legacy collection for town hall posts  
**Files**: No active write usage found
**Operations**:
- ✅ READ: Public read access
- ❌ WRITE: Creates (if verified), updates/deletes (author only)
**Current Rules**: Too permissive
**Status**: Appears to be legacy/orphaned; should be denied

#### ⚠️ **events/{eventId}** – Events (UNUSED)
**Usage**: Mentioned in rules but no active usage in codebase  
**Current Rules**: Allows public read, editor+ can create/update  
**Status**: Not used; should clarify or remove

---

## 2. Architecture Decision

**Firestore Purpose**: Identity and user profile ONLY  
- ✅ `users/{uid}`: User profiles (display name, email, city, state, role, etc.)
- ❌ `townhall_threads/*`: Moving to D1 (thread content)
- ❌ `townhall_posts/*`: Moving to D1 (legacy posts)
- ❌ `events/*`: Should use external service or D1 (not needed in Firestore)

**D1 Purpose**: All civic content  
- ✅ `townhall_posts` table: Thread submissions (via Worker API)
- ✅ `candidates` table: Bills and civic data
- ✅ `events` table: Events (if needed)

**Worker API Purpose**: Server-side writes to D1  
- ✅ `POST /api/townhall/create`: Writes thread to D1 (verified via Firebase token)
- ✅ All writes go through Worker (not client-side Firestore)

---

## 3. Current Rule Issues

### Issue 1: townhall_threads Collection Too Permissive
```javascript
match /townhall_threads/{threadId} {
  allow get, list: if true;  // ← PUBLIC READ OK
  allow create: if isVerified() && request.resource.data.createdBy == request.auth.uid;  // ← SHOULD DENY
  allow update, delete: if ...  // ← SHOULD DENY
  
  match /replies/{replyId} {
    allow create: if ...  // ← SHOULD DENY
  }
}
```
**Problem**: Still allows client-side writes to Firestore (being migrated to Worker)  
**Fix**: Deny all writes; keep public read only during transition

### Issue 2: townhall_posts Collection Too Permissive
```javascript
match /townhall_posts/{postId} {
  allow read: if true;  // ← PUBLIC READ OK
  allow create: if isVerified();  // ← SHOULD DENY
  allow update, delete: if ...  // ← SHOULD DENY
}
```
**Problem**: Allows client-side writes to legacy collection  
**Fix**: Deny all writes; keep public read if needed for backwards compatibility

### Issue 3: events Collection Unclear
**Problem**: Defined but not used in codebase; unclear purpose  
**Fix**: Either remove or clarify; for now, allow read but deny writes

### Issue 4: Helper Function Complexity
```javascript
function isVerified() {
  return request.auth != null &&
         get(/databases/$(db)/documents/users/$(request.auth.uid)).data.verified == true;
}
```
**Problem**: Reads from user doc on every auth check (expensive)  
**Fix**: Remove if not needed; Firestore now allows custom claims in auth token

---

## 4. Proposed Minimal Rule Set

### Principle: Deny-First, Allow Minimal

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    /* 👤 USER PROFILES – Identity & Profiles Only */
    match /users/{userId} {
      // Authenticated users can read their own profile
      allow get: if request.auth != null && request.auth.uid == userId;
      
      // Authenticated users can create their own profile (on signup)
      allow create: if request.auth != null && request.auth.uid == userId;
      
      // Authenticated users can update their own profile
      allow update: if request.auth != null && request.auth.uid == userId;
      
      // Authenticated users can delete their own profile
      allow delete: if request.auth != null && request.auth.uid == userId;
    }

    /* 🔒 DEFAULT DENY ALL OTHER COLLECTIONS */
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Why This Approach?

**Benefits**:
- ✅ Explicit deny-by-default (secure)
- ✅ Only allows user profile reads/writes
- ✅ No public writes (all civic content goes via Worker API to D1)
- ✅ No complex role-based logic (simplify with custom claims if needed later)
- ✅ Matches architecture decision (Firestore = identity only)

**Transition Plan**:
1. Deploy this minimal rule set
2. Monitor client-side code for `townhall_threads` and `townhall_posts` writes
3. Remove those collections from code once Worker API is live
4. Eventually delete empty collections from Firestore (optional cleanup)

---

## 5. Optional: Admin/Moderator Access (Future)

If you need admin functionality in Firestore later, add custom claims:

```javascript
/* Optional: Admin collection for moderation */
match /admin/{document=**} {
  allow get, list: if request.auth.token.admin == true;
  allow create, update, delete: if request.auth.token.admin == true;
}
```

But for now, keep it minimal.

---

## 6. Emulator Testing Plan

### Setup
```bash
# Start Firestore emulator
firebase emulators:start --only firestore,auth
# UI available at: http://localhost:4000
```

### Test 1: User Profile Self-Read (Should Pass ✅)
```javascript
// User reads their own profile
const userRef = doc(db, "users", "user123");
const snap = await getDoc(userRef);
// Expected: Success (200)
```

### Test 2: User Profile Self-Write (Should Pass ✅)
```javascript
// User updates their own profile
const userRef = doc(db, "users", "user123");
await updateDoc(userRef, { displayName: "New Name" });
// Expected: Success (200)
```

### Test 3: User Reads Other User's Profile (Should Fail ❌)
```javascript
// User123 tries to read User456's profile
const otherRef = doc(db, "users", "user456");
const snap = await getDoc(otherRef);
// Expected: Permission denied (403)
```

### Test 4: Write to townhall_threads (Should Fail ❌)
```javascript
// Try to write to old townhall_threads collection
const threadRef = collection(db, "townhall_threads");
await addDoc(threadRef, { title: "Test", content: "..." });
// Expected: Permission denied (403)
```

### Test 5: Write to townhall_posts (Should Fail ❌)
```javascript
// Try to write to legacy townhall_posts collection
const postRef = collection(db, "townhall_posts");
await addDoc(postRef, { content: "Test" });
// Expected: Permission denied (403)
```

### Test 6: Public Read of townhall_threads (Should Fail ❌)
```javascript
// Even unauthenticated users cannot read townhall_threads
const threadRef = collection(db, "townhall_threads");
const snap = await getDocs(threadRef);
// Expected: Permission denied (403)
```

---

## 7. Code Changes Needed

### 1. Update Firestore Rules (firestore.rules)
- ✅ Replace with minimal rule set below
- ✅ Remove townhall_threads rules
- ✅ Remove townhall_posts rules
- ✅ Remove events rules
- ✅ Remove admin/moderator logic (not needed yet)

### 2. Update Frontend Code (gradual migration)
**Priority 1** (Required now):
- ✅ `static/js/townhall/create-thread.js`: Switch from Firestore `addDoc` to Worker POST
  - Status: Ready (see TOWNHALL_CREATE_CODE_REFERENCE.md)

**Priority 2** (Deprecate):
- ⚠️ `static/js/townhall/threads-inline.js` (line 123): Remove `addDoc` for replies
  - Current: Adds replies to Firestore `townhall_threads/{id}/replies`
  - New: Could add replies via Worker API (if needed) or remove feature
  - For now: Comment out or remove the reply submission form

**Priority 3** (Keep for now):
- ✅ `static/js/townhall/home.js`, `threads.js`, `map.js`: READ from Firestore
  - These can stay as-is during transition
  - Once Worker API is live and D1 reads work, migrate to API calls
  - Timeline: After create-thread.js is working

### 3. Monitor & Cleanup
- Watch browser console for Firestore permission errors
- When no more writes to `townhall_threads` and `townhall_posts`:
  - Delete empty collections from Firestore console (optional)
  - Remove read code if not needed

---

## 8. Security Assessment

| Aspect | Before | After | Risk |
|--------|--------|-------|------|
| **Public Reads of Profiles** | ❌ Not allowed | ❌ Not allowed | ✅ None |
| **User Writes to Own Profile** | ✅ Allowed | ✅ Allowed | ✅ None |
| **User Writes to Civic Content** | ✅ Allowed (was in Firestore) | ❌ Must use Worker API | ✅ Better (server-side validation) |
| **Public Writes** | ❌ Not allowed | ❌ Not allowed | ✅ None |
| **Admin Access** | ⚠️ Role-based logic | ❌ Removed (add back if needed) | ⚠️ Need to re-add if admin features needed |

**Conclusion**: New rules are more secure and align with architecture.

---

## 9. Migration Checklist

- [ ] Read this analysis
- [ ] Update `firestore.rules` with minimal rule set
- [ ] Deploy rules to Firebase: `firebase deploy --only firestore:rules`
- [ ] Update `create-thread.js` to use Worker API (see TOWNHALL_CREATE_CODE_REFERENCE.md)
- [ ] Test in browser; verify no Firestore write errors for threads
- [ ] Comment out or remove reply submission in `threads-inline.js`
- [ ] Test with emulator (6 test cases below)
- [ ] Monitor production for Firestore permission errors
- [ ] Once D1 read path is live, deprecate Firestore reads
- [ ] Eventually delete empty `townhall_threads` and `townhall_posts` collections

---

## 10. Recommended Action

**Immediate** (1–2 hours):
1. Replace `firestore.rules` with minimal rule set
2. Deploy: `firebase deploy --only firestore:rules`
3. Test in emulator (6 test cases)

**Short-term** (with create-thread.js implementation):
1. Update `create-thread.js` to use Worker API
2. Comment out reply submission in `threads-inline.js`
3. Monitor for errors in production

**Long-term** (after D1 read path is live):
1. Migrate reads from Firestore to D1 API
2. Clean up empty Firestore collections
3. Consider adding admin collection if moderation features needed

---

**Summary**: Proposed minimal rule set is more secure, simpler, and aligns with architecture decision to use Firestore for identity only.
