/// ─────────────────────────────────────────────────────────────
// Cloud Functions
// • 2nd-gen HTTPS callables      →  firebase-functions/v2/https
// • 1st-gen Blocking trigger   →  firebase-functions/v1/identity
// ─────────────────────────────────────────────────────────────
const { onCall, HttpsError } = require('firebase-functions/v2/https');
// ✨ ADD THIS LINE
const identity = require('firebase-functions/v2/identity');
const admin                  = require('firebase-admin');

// ❗ REMOVE THIS LINE (No longer needed for this function)
// const functionsV1            = require('firebase-functions/v1');

admin.initializeApp();

/* ────────────────────────────────────────────────────────────
 * 1)  Keep Firestore “users/{uid}.verified” in-sync
 * ────────────────────────────────────────────────────────────*/
exports.syncEmailVerification = identity.beforeUserSignedIn((event) => {
  // The user data is now inside event.data
  const user = event.data;

  if (user.emailVerified) {
    console.log(`✅ ${user.uid} has a verified e-mail – ensuring Firestore is in-sync.`);
    try {
      // The Firestore update logic remains the same
      return admin
        .firestore()
        .doc(`users/${user.uid}`)
        .set({ verified: true }, { merge: true });
    } catch (error) {
      console.error("Failed to sync email verification status to Firestore:", error);
    }
  }
});

/* ────────────────────────────────────────────────────────────
 * 2)  Callable – assign a role level  (Super-Admin, level 100)
 * ────────────────────────────────────────────────────────────*/
exports.setUserRole = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required.');
  }
  if ((request.auth.token.roleLevel || 0) !== 100) {
    throw new HttpsError('permission-denied', 'Super-Admin only.');
  }

  const { userId, newRoleLevel } = request.data || {};
  if (!userId || newRoleLevel === undefined) {
    throw new HttpsError(
      'invalid-argument',
      'Call with { userId, newRoleLevel }.'
    );
  }

  await admin.auth().setCustomUserClaims(userId, { roleLevel: newRoleLevel });
  return { message: `Role updated – ${userId} ⇒ ${newRoleLevel}` };
});

/* ────────────────────────────────────────────────────────────
 * 3)  Callable – list users (roleLevel ≥ 80 → Admin+)
 * ────────────────────────────────────────────────────────────*/
exports.listUsers = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required.');
  }
  if ((request.auth.token.roleLevel || 0) < 80) {
    throw new HttpsError('permission-denied', 'Admin only.');
  }

  try {
    const { users: raw } = await admin.auth().listUsers(1000);
    const users = raw.map(u => ({
      uid        : u.uid,
      email      : u.email,
      displayName: u.displayName || 'No Name',
      roleLevel  : u.customClaims?.roleLevel || 0,
      disabled   : u.disabled,
    }));
    return { users };
  } catch (err) {
    console.error('listUsers failed:', err);
    throw new HttpsError('internal', 'Could not list users.');
  }
});
