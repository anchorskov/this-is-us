/* ─────────────────────────────────────────────────────────────
   File: static/js/townhall/create-thread.js
   Purpose: handle “Start a New Thread” form
   Requires: Firebase (8.x) already initialised elsewhere
   ──────────────────────────────────────────────────────────── */

console.log("🆕 create-thread.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const form     = document.getElementById("new-thread-form");
  const feedback = document.getElementById("create-thread-feedback");
  if (!form || !feedback) return;          // abort if markup missing

  /* helper – show coloured feedback message */
  const showMsg = (msg, clr /* red | green | yellow… */) => {
    feedback.textContent = msg;
    feedback.className   = `mt-2 text-${clr}-600`;
    feedback.hidden      = false;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    /* grab & trim inputs -------------------------------------------------- */
    const fd       = new FormData(form);
    const title    = (fd.get("title")    || "").trim();
    const location = (fd.get("location") || "").trim();
    const body     = (fd.get("body")     || "").trim();

    if (!title || !location || !body) {
      return showMsg("⚠️  Please fill out all fields.", "red");
    }

    /* verify auth --------------------------------------------------------- */
    const user = firebase.auth().currentUser;
    if (!user) {
      return showMsg("🔐 Please sign in first.", "red");
    }

    /* write to Firestore -------------------------------------------------- */
    try {
      await firebase
        .firestore()
        .collection("townhall_threads")          // same as list page
        .add({
          title,
          body,
          location,
          createdBy : user.uid,
          timestamp : firebase.firestore.FieldValue.serverTimestamp(),
          replyCount: 0,
        });

      showMsg("✅ Thread published!", "green");

      /* brief success pause, then return to Town-Hall landing  */
      setTimeout(() => (window.location.href = "/townhall/"), 1000);
    } catch (err) {
      console.error("Error publishing thread:", err);
      showMsg("❌ Error publishing thread – try again.", "red");
    }
  });
});
