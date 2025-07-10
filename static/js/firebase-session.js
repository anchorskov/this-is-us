// static/js/firebase-session.js  – v9 module
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

onAuthStateChanged(auth, async (user) => {
  window.currentUser = user || null;
  console.log("🔄 Auth state changed:", user?.email || "Not signed in");

  if (user && (user.emailVerified || user.phoneNumber)) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    let role = "citizen";

    if (!snap.exists()) {
      await setDoc(userRef, {
        displayName: user.displayName || "Anonymous",
        email: user.email || null,
        joinedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        role,
        city: "",
        state: ""
      });
      console.log("✅ Firestore profile created.");
    } else {
      const data = snap.data();
      role = data.role || role;
      await updateDoc(userRef, { lastLogin: new Date().toISOString() });
      console.log("👋 Firestore profile updated.");
    }

    window.currentUserRole = role;
    document.body.setAttribute("data-user-role", role);
    console.log(`👤 Current user role: ${role}`);
  } else {
    window.currentUserRole = null;
    document.body.removeAttribute("data-user-role");
  }
});

// 🔓 optional logout button
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logout-btn");
  if (!logoutBtn) return;

  onAuthStateChanged(auth, (user) => {
    logoutBtn.style.display = user ? "inline-block" : "none";
    logoutBtn.onclick = () => auth.signOut().then(() => location.reload());
  });
});
