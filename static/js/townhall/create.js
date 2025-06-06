/*  static/js/townhall/create.js
    ────────────────────────────────────────────────────────────
    “Start a new conversation” page/controller
    – graceful Firebase checks
    – disables submit while in-flight
    – captures user’s approximate coords for the map view
    – redirects straight to the new thread after creation
    ──────────────────────────────────────────────────────────── */

console.log("📝 townhall/create.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("new-thread-form");
  if (!form) return console.warn("📝 #new-thread-form not found.");

  /* ── Firebase guard ─────────────────────────────────────── */
  if (typeof firebase === "undefined" || !firebase.firestore) {
    form.innerHTML =
      `<p class="text-red-600">⚠️ Firebase not available. Cannot submit.</p>`;
    return;
  }
  const db = firebase.firestore();

  /* ── Submit handler ─────────────────────────────────────── */
  form.addEventListener("submit", async evt => {
    evt.preventDefault();

    const btn       = form.querySelector("button[type=submit]");
    const title     = form.querySelector("#new-title") .value.trim();
    const body      = form.querySelector("#new-body")  .value.trim();
    const location  = form.querySelector("#filter-location")?.value.trim() || "";
    const topic     = form.querySelector("#filter-topic")   ?.value.trim() || "";

    if (!title || !body) return alert("Please fill out title & message.");

    const user = firebase.auth().currentUser;
    if (!user) return alert("Sign-in required to post.");

    btn.disabled = true;                               // optimistic lock

    try {
      /* Optional: quick geolocation for marker accuracy */
      let coords = null;
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation ?
            navigator.geolocation.getCurrentPosition(res, rej, {timeout:6000})
            : rej("geo unavailable"));
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch(_) { /* silent – we’ll still save the thread */ }

      const ref = await db.collection("townhall_threads").add({
        title,
        body,
        location,
        topic,
        coordinates: coords,
        replyCount : 0,
        timestamp  : firebase.firestore.FieldValue.serverTimestamp(),
        authorUid  : user.uid
      });

      alert("✅ Thread posted!");
      location.href = `/townhall/thread/${ref.id}/`;    // jump straight in
    } catch (err) {
      console.error("❌ Thread create error:", err);
      alert("Couldn’t submit. Try again?");
      btn.disabled = false;
    }
  });
});
