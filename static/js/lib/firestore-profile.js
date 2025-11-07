// static/js/lib/firestore-profile.js
// Named helper → import { getUserZip } from '../../lib/firestore-profile.js'

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

/**
 * Return the user’s saved ZIP code (string) or null.
 * @param {import('firebase/firestore').Firestore} db
 * @param {string|null} uid
 */
export async function getUserZip(db, uid) {
  if (!uid) return null;
  try {
    const profileRef = doc(db, "users", uid, "private", "profile");
    const snap = await getDoc(profileRef);
    return snap.exists() ? snap.data().zip || null : null;
  } catch (err) {
    console.warn('getUserZip failed:', err);
    return null;
  }
}
