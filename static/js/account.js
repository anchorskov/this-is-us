// static/js/account.js   – v9 Firebase
console.log("📘 account.js loaded (v9)");

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const auth = getAuth();
  const db   = getFirestore();

  const form      = document.getElementById("account-form");
  const feedback  = document.getElementById("account-feedback");
  const deleteBtn = document.getElementById("delete-account-btn");

  const nameEl       = document.getElementById("account-name");
  const emailEl      = document.getElementById("account-email");
  const joinedEl     = document.getElementById("account-joined");
  const roleEl       = document.getElementById("account-role");
  const adminPanel   = document.getElementById("admin-panel");
  const newsletterEl = document.getElementById("account-newsletter");
  const cityEl       = document.getElementById("city");
  const stateEl      = document.getElementById("state");
  const resendBtn    = document.getElementById("resend-verification-btn");

  const showFeedback = (msg, type = "success") => {
    if (!feedback) return;
    feedback.textContent = msg;
    feedback.className   =
      `mt-4 text-sm text-center ${
        type === "error" ? "text-red-600" : "text-green-600"
      }`;
    feedback.style.display = "block";
    setTimeout(() => (feedback.style.display = "none"), 4000);
  };

  /* -------- Listen for auth state ------------ */
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      console.warn("🔒 Not signed in — redirecting to login");
      location.href = "/login/?redirect=/account/";
      return;
    }

    /* ---------- 1. Fetch profile from Firestore ---------- */
    const userRef = doc(db, "users", user.uid);
    let profile = {
      displayName: user.displayName || "",
      joinedAt   : new Date().toISOString().split("T")[0],
      role       : "citizen",
      newsletter : false,
      city       : "",
      state      : ""
    };

    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) Object.assign(profile, snap.data());
    } catch (err) {
      console.error("❌ Failed to fetch profile:", err);
      showFeedback("Error loading profile", "error");
    }

    /* --- Fill the UI --- */
    nameEl.value         = profile.displayName;
    emailEl.textContent  = user.email + (user.emailVerified ? " ✅" : " ❌");
    joinedEl.textContent = new Date(profile.joinedAt)
                              .toLocaleDateString(undefined,
                                { year:"numeric", month:"short", day:"numeric" });
    roleEl.textContent   = profile.role;
    newsletterEl.checked = profile.newsletter;
    cityEl.value         = profile.city  || "";
    stateEl.value        = profile.state || "";

    profile.role === "admin"
      ? adminPanel?.classList.remove("hidden")
      : adminPanel?.classList.add("hidden");

    window.currentUserRole = profile.role;

    /* ---------- 2. Resend-verification button ---------- */
    if (resendBtn) {
      resendBtn.onclick = async () => {
        try {
          await user.sendEmailVerification();
          showFeedback("Verification e-mail sent 👍");
        } catch (err) {
          console.error(err);
          showFeedback("Could not send verification e-mail", "error");
        }
      };
      resendBtn.style.display = user.emailVerified ? "none" : "inline-block";
    }

    /* ---------- 3. Save-profile handler ---------- */
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const updated = {
        displayName: nameEl.value.trim(),
        role       : profile.role,
        newsletter : newsletterEl.checked,
        joinedAt   : profile.joinedAt,
        city       : cityEl.value.trim(),
        state      : stateEl.value.trim()
      };
      try {
        await setDoc(userRef, updated, { merge: true });
        showFeedback("✅ Profile updated");
      } catch (err) {
        console.error("❌ Update failed:", err);
        showFeedback("Error updating profile", "error");
      }
    });

    /* ---------- 4. Delete-account handler ---------- */
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete your account permanently?")) return;
      try {
        await deleteDoc(userRef);
        await user.delete();
        showFeedback("Account deleted. Goodbye!");
        setTimeout(() => (location.href = "/"), 1500);
      } catch (err) {
        console.error("❌ Deletion failed:", err);
        showFeedback("Error deleting account", "error");
      }
    });
  });
});
