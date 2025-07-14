// static/js/account.js – v9 Firebase (Final hideSpinner Fix)
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
  const db = getFirestore();

  const form = document.getElementById("account-form");
  const feedback = document.getElementById("account-form-feedback");
  const deleteBtn = document.getElementById("delete-account-btn");

  const nameEl = document.getElementById("account-name");
  const emailEl = document.getElementById("account-email");
  const joinedEl = document.getElementById("account-joined");
  const roleEl = document.getElementById("account-role");
  const adminPanel = document.getElementById("admin-panel");
  const newsletterEl = document.getElementById("account-newsletter");
  const cityEl = document.getElementById("city");
  const stateEl = document.getElementById("state");
  const resendBtn = document.getElementById("resend-verification-btn");

  const loadingIndicator = document.getElementById("loading-indicator");
  const loadingMessage = document.getElementById("loading-message");

  const showFeedback = (msg, type = "success") => {
    if (!feedback) return;
    feedback.textContent = msg;
    feedback.className = `mt-4 text-sm text-center ${
      type === "error" ? "text-red-600" : "text-green-600"
    }`;
    feedback.style.display = "block";
    setTimeout(() => (feedback.style.display = "none"), 4000);
  };

  const showSpinner = (message = "Loading...") => {
    if (loadingIndicator) {
      loadingIndicator.classList.remove("hidden");
      loadingIndicator.style.display = "flex"; // Ensure it's shown
      loadingMessage.textContent = message;
    }
  };

  const hideSpinner = () => {
    if (loadingIndicator) {
      loadingIndicator.classList.add("hidden");
      loadingIndicator.style.display = "none"; // 🔒 hard hide
    }
    if (loadingMessage) {
      loadingMessage.textContent = "";
    }
    console.log("✅ hideSpinner called");
  };

  // Optional: expose for console testing
  window.hideSpinner = hideSpinner;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      console.warn("🔒 Not signed in — showing modal auth");
      window.dispatchEvent(new CustomEvent("floating-auth-request", {
        detail: { redirect: window.location.pathname }
      }));
      return;
    }

    showSpinner("Fetching profile...");
    const userRef = doc(db, "users", user.uid);
    let profile = {
      displayName: user.displayName || "",
      joinedAt: new Date().toISOString().split("T")[0],
      role: "citizen",
      newsletter: false,
      city: "",
      state: ""
    };

    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) Object.assign(profile, snap.data());
      console.log("✅ Fetched user profile:", profile);
    } catch (err) {
      console.error("❌ Failed to fetch profile:", err);
      showFeedback("Error loading profile", "error");
    } finally {
      console.log("🎯 Reached finally block — hiding spinner");
      hideSpinner();
    }

    if (nameEl) nameEl.value = profile.displayName;
    if (emailEl) emailEl.textContent = user.email + (user.emailVerified ? " ✅" : " ❌");
    if (joinedEl) joinedEl.textContent = new Date(profile.joinedAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
    if (roleEl) roleEl.textContent = profile.role;
    if (newsletterEl) newsletterEl.checked = profile.newsletter;
    if (cityEl) cityEl.value = profile.city || "";
    if (stateEl) stateEl.value = profile.state || "";

    if (adminPanel) {
      profile.role === "admin" ?
        adminPanel.classList.remove("hidden") :
        adminPanel.classList.add("hidden");
    }

    window.currentUserRole = profile.role;

    if (resendBtn) {
      resendBtn.onclick = async () => {
        showSpinner("Sending verification email...");
        try {
          await user.sendEmailVerification();
          showFeedback("Verification e-mail sent 👍");
        } catch (err) {
          console.error(err);
          showFeedback("Could not send verification e-mail", "error");
        } finally {
          hideSpinner();
        }
      };
      resendBtn.style.display = user.emailVerified ? "none" : "inline-block";
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        showSpinner("Saving changes...");
        const updated = {
          displayName: nameEl.value.trim(),
          role: profile.role,
          newsletter: newsletterEl.checked,
          joinedAt: profile.joinedAt,
          city: cityEl.value.trim(),
          state: stateEl.value.trim()
        };
        try {
          await setDoc(userRef, updated, { merge: true });
          showFeedback("✅ Profile updated");
        } catch (err) {
          console.error("❌ Update failed:", err);
          showFeedback("Error updating profile", "error");
        } finally {
          hideSpinner();
        }
      });
    }

    if (window.location.pathname.includes("/account/topic-requests")) {
      const script = document.createElement("script");
      script.src = "/js/account/topic-requests.js";
      script.type = "module";
      document.body.appendChild(script);
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        if (!confirm("Delete your account permanently?")) return;
        showSpinner("Deleting account...");
        try {
          await deleteDoc(userRef);
          await user.delete();
          showFeedback("Account deleted. Goodbye!");
          setTimeout(() => (location.href = "/"), 1500);
        } catch (err) {
          console.error("❌ Deletion failed:", err);
          showFeedback("Error deleting account", "error");
        } finally {
          hideSpinner();
        }
      });
    }

    setTimeout(() => {
      console.log("⏱️ Failsafe spinner hide triggered");
      hideSpinner();
    }, 3000);
  });
});
