/* static/js/account/preferences.js – Hot-Button Topics logic (Firebase v9) */
console.log("🎯 preferences.js loaded");

import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

/* ──────────────────────────────────────────────────────────
   1) Ensure Firebase app exists (in case firebase-config.js
      hasn’t run yet – user may land directly on /preferences/)
   ────────────────────────────────────────────────────────── */
if (!getApps().length) {
  const cfgTag = /** @type {HTMLScriptElement|null} */ (
    document.getElementById("__fbCfg")
  );
  if (cfgTag) {
    initializeApp(JSON.parse(cfgTag.textContent));
    console.log("✅ Firebase app initialised by preferences.js");
  } else {
    console.error("❌ Firebase config not found – aborting.");
    const formEl = document.getElementById("preferences-form");
    if (formEl) {
      formEl.innerHTML = "<p>Init error. Refresh the page.</p>";
    }
    throw new Error("Firebase config missing");
  }
}

/* ──────────────────────────────────────────────────────────
   2) DOM refs & helpers
   ────────────────────────────────────────────────────────── */
import { apiRoot } from "/js/lib/api-root.js";

const formEl              = document.getElementById("preferences-form");
const prefsLoadingSpinner = document.getElementById("prefs-loading");
const prefsLoadingMessage = document.getElementById("prefs-loading-message");
const prefsFeedbackEl     = document.getElementById("prefs-feedback");

const topicsContainer = document.createElement("div");
topicsContainer.id = "topics-container";

/* Initial state */
if (prefsLoadingSpinner) prefsLoadingSpinner.style.display = "none"; // hide spinner

/* Insert topics container just before the feedback element, or at top of form */
if (formEl) {
  if (prefsFeedbackEl && formEl.contains(prefsFeedbackEl)) {
    formEl.insertBefore(topicsContainer, prefsFeedbackEl);
  } else {
    formEl.prepend(topicsContainer);
  }
}

const showPrefsFeedback = (msg, type = "success") => {
  if (!prefsFeedbackEl) {
    console.warn("Preferences feedback element not found with ID 'prefs-feedback'");
    return;
  }
  prefsFeedbackEl.textContent = msg;
  prefsFeedbackEl.className =
    `mt-4 text-sm text-center ${
      type === "error" ? "text-red-600" : "text-green-600"
    }`;
  prefsFeedbackEl.classList.remove("hidden");
  setTimeout(() => prefsFeedbackEl.classList.add("hidden"), 4000);
};

const showPrefsSpinner = (message = "Loading...") => {
  if (prefsLoadingSpinner) {
    prefsLoadingSpinner.style.display = 'flex'; // Use direct style manipulation
    if (prefsLoadingMessage) prefsLoadingMessage.textContent = message;
    console.log("Spinner shown:", message); // Diagnostic log
  }
};

const hidePrefsSpinner = () => {
  if (prefsLoadingSpinner) {
    prefsLoadingSpinner.style.display = 'none'; // Use direct style manipulation
    console.log("Spinner hidden. Current display style:", prefsLoadingSpinner.style.display); // Diagnostic log
  }
};

/* ──────────────────────────────────────────────────────────
   3) Main logic
   ────────────────────────────────────────────────────────── */
const auth = getAuth();

onAuthStateChanged(auth, async (user) => {
  console.log("🔍 auth state:", user ? {
    uid: user.uid,
    emailVerified: user.emailVerified
  } : null);

  if (!user || !user.emailVerified) {
    console.warn("🚧 verify-email gate triggered – user is",
      user ? "unverified" : "null/guest");
    hidePrefsSpinner(); // Hide spinner if not verified
    if (formEl) {
      formEl.innerHTML = "<p>You must verify your e-mail before choosing preferences.</p>";
    }
    return;
  }

  try {
    showPrefsSpinner("Fetching topics..."); // Show spinner before fetch

    /* 🔹 GET topics + user picks */
    const idToken = await user.getIdToken();
    const resp = await fetch(`${apiRoot()}/user-topics`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${idToken}` },
    });

    if (!resp.ok) throw new Error(`Back-end returned ${resp.status}`);

    const list = await resp.json();
    const introBanner = document.getElementById("intro-banner");
    if (introBanner) {
      const allOff = list.every(t => !t.checked);   // no topics selected yet
      introBanner.style.display = allOff ? "block" : "none";
    }
    
    /* Render topic check-boxes */
    if (!Array.isArray(list) || !list.length) {
      topicsContainer.innerHTML = "<p>No topics available yet.</p>";
    } else {
      topicsContainer.innerHTML = "";               // clear any previous markup
      list.forEach(t => {
        const label = document.createElement("label");
        label.className = "block my-1";
        label.innerHTML = `
          <input type="checkbox" value="${t.id}" ${t.checked ? "checked" : ""}>
          ${t.name}
        `;
        topicsContainer.appendChild(label);
      });
    }

    // Diagnostic delay for spinner dismissal - Temporarily commented out for testing
    // await new Promise(resolve => setTimeout(resolve, 500)); 

  } catch (err) {
    console.error("Failed to load preferences:", err);
    if (topicsContainer) {
      topicsContainer.innerHTML =
        "<p class='text-red-600'>Couldn’t load preferences (server error).</p>";
    }
    showPrefsFeedback("Error loading topics", "error");
  } finally {
    // Ensure spinner is hidden in all final states of the initial load attempt
    hidePrefsSpinner(); 
  }
});

/* 💾 Save handler Post immediately on toggle */
topicsContainer.addEventListener("change", async (evt) => {
  if (evt.target && evt.target.type === "checkbox") {
    const box      = /** @type {HTMLInputElement} */ (evt.target);
    const topicId  = Number(box.value);
    const idToken  = await auth.currentUser.getIdToken();

    try {
      await fetch(`${apiRoot()}/user-topics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },

        body: JSON.stringify({ topicId, checked: box.checked })
      });
      showPrefsFeedback("Preference saved!");
    } catch (err) {
      console.error("Toggle failed:", err);
      showPrefsFeedback("Error saving", "error");
      box.checked = !box.checked;        // roll back UI
    }
  }
});

/* ──────────────────────────────────────────────────────────
   4) “Request new topic” form
   ────────────────────────────────────────────────────────── */
const requestTopicForm = document.getElementById("request-topic-form");
if (requestTopicForm) {
  requestTopicForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showPrefsSpinner("Submitting topic request...");
    const input = /** @type {HTMLInputElement} */ (
      document.getElementById("new-topic-name")
    );
    const newTopic = input ? input.value.trim() : "";
    if (!newTopic) {
      hidePrefsSpinner();
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.emailVerified) {
      showPrefsFeedback("You must verify your e-mail first.", "error");
      hidePrefsSpinner();
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const requestResp = await fetch(`${apiRoot()}/topic-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ newTopic })
      });


      if (!requestResp.ok) throw new Error(`Request failed: ${requestResp.status}`);
      showPrefsFeedback("👍 Topic request submitted for review!");
      if (input) input.value = "";
    } catch (requestErr) {
      console.error("❌ Topic request failed:", requestErr);
      showPrefsFeedback("Error submitting topic request", "error");
    } finally {
      hidePrefsSpinner();
    }
  });
}
