/* static/js/account/preferences.js – Hot-Button Topics logic (Firebase v9) */
console.log("🎯 preferences.js loaded");

import { getApps, initializeApp }   from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
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
    document.getElementById("preferences-form").innerHTML =
      "<p>Init error. Refresh the page.</p>";
    throw new Error("Firebase config missing");
  }
}

/* ──────────────────────────────────────────────────────────
   2) DOM refs & helpers
   ────────────────────────────────────────────────────────── */
const API      = window.EVENTS_API_URL || "/api";
const formEl   = document.getElementById("preferences-form");
const spinner  = document.getElementById("prefs-loading");

/* show spinner now (flex) */
if (spinner) spinner.style.display = "flex";
if (formEl)  formEl.innerHTML = "Loading…";

/* ──────────────────────────────────────────────────────────
   3) Main logic
   ────────────────────────────────────────────────────────── */
const auth = getAuth();

onAuthStateChanged(auth, async (user) => {
  if (!user || !user.emailVerified) {
    if (spinner) spinner.style.display = "none";
    formEl.innerHTML =
      "<p>You must verify your e-mail before choosing preferences.</p>";
    return;
  }

  try {
    /* 🔹 GET topics + user picks */
    const resp = await fetch(`${API}/preferences`, {
      headers: { Authorization: `Bearer ${await user.getIdToken()}` }
    });
    if (!resp.ok) throw new Error(`Back-end returned ${resp.status}`);

      const { topics, firstTime } = await resp.json();
      if (!Array.isArray(topics) || !topics.length) {
      formEl.innerHTML = "<p>No topics available yet.</p>";
      if (spinner) spinner.style.display = "none";
      return;
    }

    /* 🔸 Render check-boxes */
    formEl.innerHTML = "";
    topics.forEach((t) => {
      const label = document.createElement("label");
      label.className = "block my-1";
      label.innerHTML = `
        <input type="checkbox" value="${t.id}" ${t.interested ? "checked" : ""}>
        ${t.name}
      `;
      formEl.appendChild(label);
    });

    /* 💾 Save handler */
    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const selected = Array.from(
        formEl.querySelectorAll("input[type=checkbox]:checked")
      ).map((i) => i.value);

      await fetch(`${API}/preferences`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ selected })
      });
      alert("✅ Preferences saved!");
    });
  } catch (err) {
    console.error("Failed to load preferences:", err);
    formEl.innerHTML =
      "<p class='text-red-600'>Couldn’t load preferences (server error).</p>";
  } finally {
    /* hide spinner when done */
    if (spinner) spinner.style.display = "none";
  }
});

/* ──────────────────────────────────────────────────────────
   4) “Request new topic” form
   ────────────────────────────────────────────────────────── */
document
  .getElementById("request-topic-form")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = /** @type {HTMLInputElement} */ (
      document.getElementById("new-topic-name")
    );
    const newTopic = input.value.trim();
    if (!newTopic) return;

    const user = auth.currentUser;
    if (!user || !user.emailVerified) {
      alert("You must verify your e-mail first.");
      return;
    }

    await fetch(`${API}/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ newTopic })
    });

    alert("👍 Topic request submitted for review!");
    input.value = "";
  });
