// static/js/firebase-session.js
console.log("🔄 firebase-session.js loaded (v9)");

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();

// Detect local dev vs production
const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const apiBase = isLocal ? "http://127.0.0.1:8787/api" : "/api";

/**
 * Sync current Firebase user to D1 `user_preferences` table.
 */
async function seedUserToD1(user) {
  if (!user?.uid || !user.email) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const data = snap.exists() ? snap.data() : {};

    const city = data.city || "";
    const state = data.state || "";

    const res = await fetch(`${apiBase}/sync-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        city,
        state
      })
    });

    if (res.ok) {
      console.log("🌱 Seeded user into D1");
    } else {
      console.warn("⚠️ Failed to seed D1 – status", res.status);
    }
  } catch (err) {
    console.error("❌ Error syncing user to D1", err);
  }
}

// 🔄 Auth listener
onAuthStateChanged(auth, async (user) => {
  window.currentUser = user || null;
  console.log("🔄 Auth state changed:", user?.email || "Not signed in");

  if (user && (user.emailVerified || user.phoneNumber)) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    let role = "citizen";
    let city = "";
    let state = "";

    if (!snap.exists()) {
      await setDoc(userRef, {
        displayName: user.displayName || "Anonymous",
        email: user.email || null,
        joinedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        role,
        city,
        state
      });
      console.log("✅ Firestore profile created.");
    } else {
      const data = snap.data();
      role = data.role || role;
      city = data.city || "";
      state = data.state || "";
      await updateDoc(userRef, { lastLogin: new Date().toISOString() });
      console.log("👋 Firestore profile updated.");
    }

    await seedUserToD1(user);

    window.currentUserRole = role;
    document.body.setAttribute("data-user-role", role);
    console.log(`👤 Current user role: ${role}`);
  } else {
    window.currentUserRole = null;
    document.body.removeAttribute("data-user-role");
  }
});

// 🔓 Optional logout logic
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logout-btn");
  if (!logoutBtn) return;

  onAuthStateChanged(auth, (user) => {
    logoutBtn.style.display = user ? "inline-block" : "none";
    logoutBtn.onclick = () => auth.signOut().then(() => location.reload());
  });
});
