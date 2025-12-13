# Firestore Security Rules – Deployment & Testing Guide

**Date Updated**: 2025
**Status**: Ready for Deployment
**Effort**: 20 minutes (deployment + emulator testing)
**Risk Level**: 🟢 LOW (rules are MORE restrictive, not breaking existing functionality)

---

## 📋 Summary of Changes

**Previous Rules** (110 lines):
- ❌ townhall_threads/* allowed verified user writes (client-side)
- ❌ townhall_posts/* allowed verified user creates (client-side)
- ❌ events/* allowed editor-level writes (not needed)
- ❌ Complex role-based logic using custom claims

**New Rules** (65 lines):
- ✅ Only users/{userId} allows read/write (by authenticated user on own profile)
- ✅ All other collections denied by default (fail-secure)
- ✅ Civic content writes must use Worker API (POST /api/townhall/create)
- ✅ No role-based logic in rules (simpler, more maintainable)
- ✅ Aligns with architecture (Firestore = identity only, D1 = civic content)

---

## 🚀 Deployment Steps

### Step 1: Verify Rules File
```bash
# Check that firestore.rules has been updated
cat firestore.rules | head -20
# Should show the new header with "Identity & Profile Only"
```

### Step 2: Deploy to Firebase
```bash
# Deploy ONLY the Firestore rules (don't deploy anything else)
firebase deploy --only firestore:rules
```

Expected output:
```
✔ Deploy complete!

Project Console: https://console.firebase.google.com/project/[project-id]/firestore
```

### Step 3: Verify Deployment
```bash
# Optional: View rules in Firebase Console
# Go to: https://console.firebase.google.com/project/[project-id]/firestore/rules
# Should show the new 65-line minimal rules
```

---

## 🧪 Testing with Firebase Emulator

### Setup Emulator (if not already running)

```bash
# Start the Firebase emulator suite
firebase emulators:start

# In another terminal, run tests (see below)
```

The emulator should print:
```
✔ firestore emulator started
  Port: 8080
  Web UI: http://localhost:4000
```

### Test 1: User Can Read Own Profile ✅ SHOULD PASS
```javascript
// Firestore emulator test
const auth = initializeAuth(/* ...config... */);
const user = await signInWithEmailAndPassword(auth, 'user@example.com', 'password');

const db = initializeFirestore(/* ...config... */);
const userDoc = doc(db, 'users', user.user.uid);
const snapshot = await getDoc(userDoc);

console.log('✅ User can read own profile:', snapshot.exists());
```

**Expected**: ✅ snapshot.exists() === true

---

### Test 2: User Can Update Own Profile ✅ SHOULD PASS
```javascript
const userDoc = doc(db, 'users', user.user.uid);
await updateDoc(userDoc, {
  displayName: 'New Name',
  updatedAt: new Date().toISOString()
});

console.log('✅ User can update own profile');
```

**Expected**: ✅ No error thrown

---

### Test 3: User Cannot Read Another User's Profile ❌ SHOULD FAIL
```javascript
const otherUserDoc = doc(db, 'users', 'some-other-uid');
try {
  await getDoc(otherUserDoc);
  console.log('❌ SECURITY ISSUE: User read another user\'s profile!');
} catch (error) {
  console.log('✅ User correctly denied read to another profile:', error.message);
}
```

**Expected**: ❌ Error: "Missing or insufficient permissions"

---

### Test 4: User Cannot Write to townhall_threads ❌ SHOULD FAIL
```javascript
try {
  await addDoc(collection(db, 'townhall_threads'), {
    title: 'Test Thread',
    body: 'This should fail',
    createdBy: user.user.uid,
    timestamp: new Date().toISOString()
  });
  console.log('❌ SECURITY ISSUE: User wrote to townhall_threads!');
} catch (error) {
  console.log('✅ User correctly denied write to townhall_threads:', error.message);
}
```

**Expected**: ❌ Error: "Missing or insufficient permissions"

---

### Test 5: User Cannot Write to townhall_posts ❌ SHOULD FAIL
```javascript
try {
  await addDoc(collection(db, 'townhall_posts'), {
    title: 'Test Post',
    prompt: 'This should fail',
    createdBy: user.user.uid,
    timestamp: new Date().toISOString()
  });
  console.log('❌ SECURITY ISSUE: User wrote to townhall_posts!');
} catch (error) {
  console.log('✅ User correctly denied write to townhall_posts:', error.message);
}
```

**Expected**: ❌ Error: "Missing or insufficient permissions"

---

### Test 6: Anonymous User Cannot Read townhall_threads ❌ SHOULD FAIL
```javascript
const unAuthDb = initializeFirestore(/* ...unauthenticated... */);
try {
  await getDocs(collection(unAuthDb, 'townhall_threads'));
  console.log('❌ SECURITY ISSUE: Unauthenticated user read townhall_threads!');
} catch (error) {
  console.log('✅ Unauthenticated user correctly denied read:', error.message);
}
```

**Expected**: ❌ Error: "Missing or insufficient permissions"

---

## 📊 Test Results Checklist

After running all 6 tests with the emulator:

| Test | Expected | Result | Status |
|------|----------|--------|--------|
| 1. User reads own profile | ✅ PASS | | [ ] |
| 2. User updates own profile | ✅ PASS | | [ ] |
| 3. User reads other profile | ❌ FAIL | | [ ] |
| 4. Write to townhall_threads | ❌ FAIL | | [ ] |
| 5. Write to townhall_posts | ❌ FAIL | | [ ] |
| 6. Anonymous reads collection | ❌ FAIL | | [ ] |

---

## 🔍 Monitoring After Deployment

### What to Watch For

After deploying to production, monitor:

1. **Firebase Console - Error Rate**
   - Go to: https://console.firebase.google.com/project/[project-id]/monitoring
   - Should see drop in "Permission Denied" errors (old rules allowed reads)
   - Should see spike in "Permission Denied" on client write attempts (expected during migration)

2. **Browser Console - Network Errors**
   - create-thread.js still tries to write to Firestore (will fail)
   - This is EXPECTED during migration
   - Errors will disappear when create-thread.js switches to Worker API

3. **User Profile Operations** (firebase-session.js, account.js)
   - Signup flow: users/{uid} creation should work ✅
   - Profile updates: updateDoc should work ✅
   - No changes needed to these flows

---

## ⚠️ Known Behavior During Migration

### Before create-thread.js is Updated

**Symptom**: Users get "Missing or insufficient permissions" error when trying to create threads

**Why**: Old Firestore write is blocked (intended)

**What's Happening**:
1. User submits form in create-thread.js
2. addDoc(...) tries to write to townhall_threads
3. Firestore rules deny the write (✅ working as designed)
4. Error appears in console (expected)

**Solution**: Update create-thread.js to POST to /api/townhall/create (Worker API) instead of Firestore

See: **TOWNHALL_CREATE_DESIGN.md** for implementation details

---

## ✅ Verification Checklist

- [ ] Deployed firestore.rules to Firebase
- [ ] All 6 emulator tests passed
- [ ] User signup flow works (users/{uid} creation)
- [ ] User profile updates work (updateDoc on users/{uid})
- [ ] create-thread.js shows Firestore permission error in console (expected)
- [ ] No errors in other workflows (account.js, firebase-session.js)
- [ ] Firestore error rate decreased in console (fewer unexpected collections)
- [ ] Ready to proceed with create-thread.js migration

---

## 🔄 Rollback Plan (if needed)

If there are unexpected issues:

```bash
# View deployment history
firebase deploy:list

# Rollback to previous rules
firebase deploy --only firestore:rules --revision [revision-id]
```

However, rollback should not be necessary because:
- New rules are MORE restrictive (can't break existing functionality)
- Only users/{uid} is affected (and it still works the same)
- Civic content collections are now denied (expected behavior)

---

## 📚 Reference Documents

- **FIRESTORE_RULES_ANALYSIS.md** - Comprehensive analysis of changes
- **TOWNHALL_CREATE_DESIGN.md** - How to update create-thread.js (Worker API)
- **firestore.rules** - The actual rules file (65 lines)

---

## ✨ Success Criteria

✅ All 6 emulator tests pass
✅ User signup/login works normally
✅ Profile updates work normally
✅ Firestore permission errors appear in create-thread.js (expected during migration)
✅ Error rate in Firebase console shows decline in unexpected access
✅ No errors in account.js or firebase-session.js workflows

**Timeline**: ~20 minutes for deployment + testing
**Next Step**: Update create-thread.js to use Worker API (see TOWNHALL_CREATE_DESIGN.md)
