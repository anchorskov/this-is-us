/* ─────────────────────────────────────────────────────────────
   File: static/js/townhall/create-thread.js
   Purpose: handle “Start a New Thread” form (Firebase v9)
   ──────────────────────────────────────────────────────────── */
console.log("🆕 create-thread.js loaded (v9)");

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

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
  const db   = getFirestore();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    /* grab & trim inputs ---------------------------------------------- */
    const fd       = new FormData(form);
    const title    = (fd.get("title")    || "").trim();
    const location = (fd.get("location") || "").trim();
    const body     = (fd.get("body")     || "").trim();

    if (!title || !location || !body) {
      return showMsg("⚠️  Please fill out all fields.", "red");
    }

    /* verify auth ----------------------------------------------------- */
    const user = auth.currentUser;
    if (!user) {
      return showMsg("🔐 Please sign in first.", "red");
    }

    /* write to Firestore ---------------------------------------------- */
    try {
      await addDoc(collection(db, "townhall_threads"), {
        title,
        body,
        location,
        createdBy : user.uid,
        timestamp : serverTimestamp(),
        replyCount: 0
      });

      showMsg("✅ Thread published!", "green");

      /* brief success pause, then back to landing */
      setTimeout(() => (location.href = "/townhall/"), 1000);
    } catch (err) {
      console.error("Error publishing thread:", err);
      showMsg("❌ Error publishing thread – try again.", "red");
    }
  });
});
