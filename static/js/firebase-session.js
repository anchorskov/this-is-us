// static/js/firebase-session.js
console.log("🔄 firebase-session.js loaded");

if (typeof firebase === "undefined") {
  console.error("❌ Firebase not loaded.");
} else {
  const auth = firebase.auth();
  const db = firebase.firestore();

  auth.onAuthStateChanged(async (user) => {
    window.currentUser = user || null;
    console.log("🔄 Auth state changed:", user?.email || "Not signed in");

    if (user && (user.emailVerified || user.phoneNumber)) {
      const userRef = db.collection("users").doc(user.uid);
      const doc = await userRef.get();

      if (!doc.exists) {
        await userRef.set({
          displayName: user.displayName || "Anonymous",
          email: user.email || null,
          joinedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          role: "citizen"
        });
        console.log("✅ Firestore profile created.");
      } else {
        await userRef.update({
          lastLogin: new Date().toISOString()
        });
        console.log("👋 Firestore profile updated.");
      }
    }
  });

  // Optional logout button support
  document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      auth.onAuthStateChanged(user => {
        logoutBtn.style.display = user ? "inline-block" : "none";
        logoutBtn.onclick = () => auth.signOut().then(() => location.reload());
      });
    }
  });
}
