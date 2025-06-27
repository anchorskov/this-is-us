// static/js/lib/firestore-profile.js
// Named helper → import { getUserZip } from '../../lib/firestore-profile.js'

/**
 * Return the user’s saved ZIP code (string) or null.
 * @param {firebase.firestore.Firestore} db
 * @param {string|null} uid
 */
export async function getUserZip(db, uid) {
  if (!uid) return null;
  try {
    const snap = await db
      .doc(`users/${uid}/private/profile`)
      .get({ source: 'server' });           // avoid stale cache
    return snap.exists ? snap.data().zip || null : null;
  } catch (err) {
    console.warn('getUserZip failed:', err);
    return null;
  }
}
