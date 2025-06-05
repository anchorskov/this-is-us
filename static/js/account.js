// Logic for populating and updating the /account/ page with Firebase authentication and Firestore

console.log("📘 account.js loaded");

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof firebase === "undefined" || !firebase.auth || !firebase.firestore) {
    console.error("❌ Firebase not fully loaded in account.js");
    return;
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  const form = document.getElementById("account-form");
  const feedback = document.getElementById("account-feedback");
  const deleteBtn = document.getElementById("delete-account-btn");

  const nameEl = document.getElementById("account-name");
  const emailEl = document.getElementById("account-email");
  const joinedEl = document.getElementById("account-joined");
  const roleEl = document.getElementById("account-role");
  const adminPanel = document.getElementById("admin-panel");
  const newsletterEl = document.getElementById("account-newsletter");
  const cityEl = document.getElementById("city");
  const stateEl = document.getElementById("state");

  function showFeedback(msg, type = "success") {
    if (feedback) {
      feedback.textContent = msg;
      feedback.className = `mt-4 text-sm text-center ${type === "error" ? "text-red-600" : "text-green-600"}`;
      feedback.style.display = "block";
      setTimeout(() => (feedback.style.display = "none"), 4000);
    }
  }

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.warn("🔒 Not signed in — redirecting to login");
      window.location.href = "/login/?redirect=/account/";
      return;
    }

    const userRef = db.collection("users").doc(user.uid);
    let profile = {
      displayName: user.displayName || "",
      joinedAt: new Date().toISOString().split("T")[0],
      role: "citizen",
      newsletter: false,
      city: "",
      state: ""
    };

    try {
      const doc = await userRef.get();
      if (doc.exists) Object.assign(profile, doc.data());
    } catch (err) {
      console.error("❌ Failed to fetch profile:", err);
      showFeedback("Error loading profile", "error");
    }

    // Pre-fill form
    nameEl.value = profile.displayName;
    emailEl.textContent = user.email;
    joinedEl.textContent = new Date(profile.joinedAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    roleEl.textContent = profile.role;

    if (profile.role === "admin" && adminPanel) {
      adminPanel.classList.remove("hidden");
    } else if (adminPanel) {
      adminPanel.classList.add("hidden");
    }

    newsletterEl.checked = profile.newsletter;
    cityEl.value = profile.city || "";
    stateEl.value = profile.state || "";

    // Set global role for admin UI detection
    window.currentUserRole = profile.role;

    // Save handler
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const updatedProfile = {
        displayName: nameEl.value.trim(),
        role: profile.role,
        newsletter: newsletterEl.checked,
        joinedAt: profile.joinedAt,
        city: cityEl.value.trim(),
        state: stateEl.value.trim()
      };

      try {
        await userRef.set(updatedProfile, { merge: true });
        showFeedback("✅ Profile updated successfully");
      } catch (err) {
        console.error("❌ Update failed:", err);
        showFeedback("Error updating profile", "error");
      }
    });

    // Delete handler
    deleteBtn.addEventListener("click", async () => {
      const confirmDelete = confirm("Are you sure you want to delete your account? This action is irreversible.");
      if (!confirmDelete) return;

      try {
        await userRef.delete();
        await user.delete();
        showFeedback("Account deleted. Goodbye!");
        setTimeout(() => (window.location.href = "/"), 1500);
      } catch (err) {
        console.error("❌ Deletion failed:", err);
        showFeedback("Error deleting account", "error");
      }
    });
  });
});
