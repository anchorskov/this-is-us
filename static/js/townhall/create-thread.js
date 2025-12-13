/* ─────────────────────────────────────────────────────────────
   File: static/js/townhall/create-thread.js
   Purpose: handle “Start a New Thread” form (Firebase v9)
   ──────────────────────────────────────────────────────────── */
console.log("🆕 create-thread.js loaded (v9)");

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const form     = document.getElementById("new-thread-form");
  const feedback = document.getElementById("create-thread-feedback");
  if (!form || !feedback) return; // abort if markup missing

  /* helper – coloured feedback message */
  const showMsg = (msg, clr /* red | green | yellow … */) => {
    feedback.textContent = msg;
    feedback.className   = `mt-2 text-${clr}-600`;
    feedback.hidden      = false;
  };

  const auth = getAuth();

  const setSubmitting = (isSubmitting) => {
    const btn = form.querySelector("[type=submit]");
    if (!btn) return;
    btn.disabled = isSubmitting;
    btn.textContent = isSubmitting ? "Publishing…" : "Publish Thread";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    /* grab & trim inputs ---------------------------------------------- */
    const fd          = new FormData(form);
    const title       = (fd.get("title")    || "").trim();
    const locationVal = (fd.get("location") || "").trim();
    const body        = (fd.get("body")     || "").trim();

    if (!title || !locationVal || !body) {
      return showMsg("⚠️  Please fill out all fields (title, location, body).", "red");
    }

    /* verify auth ----------------------------------------------------- */
    const user = auth.currentUser;
    if (!user) {
      return showMsg("🔐 Please sign in first.", "red");
    }

   setSubmitting(true);

    /* write to Worker (D1) -------------------------------------------- */
    try {
      const data = await submitThread(user, {
        title,
        prompt: body,
        city: locationVal || "",
        state: "WY",
      });
      console.log("Thread created:", data);

      showMsg("✅ Thread published!", "green");

      /* brief success pause, then back to landing */
      setTimeout(() => (window.location.href = "/townhall/"), 800);
    } catch (err) {
      console.error("Error publishing thread:", err);
      const msg = err?.responseMessage || err?.message || "Error publishing thread – try again.";
      showMsg(`❌ ${msg}`, "red");
    } finally {
      setSubmitting(false);
    }
  });
});

export async function submitThread(user, payload) {
  if (!user || typeof user.getIdToken !== "function") {
    throw new Error("Unauthorized");
  }
  const token = await user.getIdToken();
  const res = await fetch("/api/townhall/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(errText || `Request failed (${res.status})`);
    try {
      const parsed = JSON.parse(errText);
      err.responseMessage = parsed?.message || parsed?.error;
    } catch {
      err.responseMessage = null;
    }
    throw err;
  }
  return res.json();
}
