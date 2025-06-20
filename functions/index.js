// functions/index.js  (or .ts if you prefer)
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.syncEmailVerification = functions.auth.user().onUpdate(async (change) => {
  const before = change.before;
  const after  = change.after;
  if (!before.emailVerified && after.emailVerified) {
    // Mark verified in Firestore
    await admin.firestore().doc(`users/${after.uid}`).set(
      { verified: true }, { merge: true }
    );
  }
});
