/*  static/js/townhall/threads.js
    ────────────────────────────────────────────────────────────
    Purpose  ▸ Stand-alone controller for /townhall/threads/*
              (lists Nearby / Trending / Mine – *not* the map
              landing page, which is handled by home.js).
    Notes    ▸ Pure vanilla JS  – no external deps except
              Leaflet (optional) & Firebase.
            ▸ Uses “progressively-hydrated” rendering:
              ① skeleton placeholder
              ② Firestore payload streamed in
            ▸ Re-usable util renderThreadCard()
    ──────────────────────────────────────────────────────────── */

console.log("📂 townhall/threads.js loaded");

let db;

/* ─── Helpers ────────────────────────────────────────────── */
const qs    = (sel, par = document) => par.querySelector(sel);
const qsa   = (sel, par = document) => [...par.querySelectorAll(sel)];
const $$new = (tag, cls, html = "") => {
  const el = document.createElement(tag);
  if (cls)  el.className = cls;
  el.innerHTML = html;
  return el;
};

function niceDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleString() : "—";
}

function renderThreadCard(id, t) {
  return `
    <h3 class="font-semibold text-lg">${t.title || "Untitled"}</h3>
    <p class="text-gray-600 line-clamp-3">${t.body || ""}</p>
    <p class="text-sm text-gray-500 mt-1">
      📍 ${t.location || "Unknown"} • 🕒 ${niceDate(t.timestamp)}
    </p>
    <div class="mt-3 flex justify-between items-center">
      <a href="/townhall/thread/${id}"
         class="text-blue-600 hover:underline font-medium">Open&nbsp;↗</a>
      <span class="text-xs text-gray-400">${t.replyCount || 0}&nbsp;replies</span>
    </div>`;
}

/* ─── Main ----------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  const wrap = qs("#thread-list") || qs(".thread-list");
  if (!wrap) return console.warn("📂 No thread-list wrapper!");

  if (typeof firebase === "undefined" || !firebase.firestore) {
    wrap.innerHTML = `<div class="text-red-600">
                        Firebase not loaded – can’t fetch threads.</div>`;
    return;
  }
  db = firebase.firestore();

  /* 1️⃣  Show skeleton while loading */
  wrap.innerHTML = "<p class='text-gray-500'>Loading threads…</p>";

  try {
    /** @type {firebase.firestore.Query} */
    let query = db.collection("townhall_threads")
                  .orderBy("timestamp", "desc")
                  .limit(25);

    // Simple filter on ?tab=   (/townhall/threads/?tab=trending)
    const urlTab = new URLSearchParams(location.search).get("tab");
    if (urlTab === "trending") query = db.collection("townhall_threads")
                                         .orderBy("replyCount", "desc")
                                         .limit(25);
    if (urlTab === "mine") {
      const user = firebase.auth().currentUser;
      if (user) query = db.collection("townhall_threads")
                          .where("authorUid", "==", user.uid)
                          .orderBy("timestamp", "desc");
      else      wrap.innerHTML = "<p>Please sign in to see your threads.</p>";
    }

    const snap = await query.get();

    /* 2️⃣  Render */
    wrap.innerHTML = "";
    if (snap.empty) {
      wrap.innerHTML = `<div class="text-gray-500">
                          No threads found for this view.</div>`;
    } else {
      const frag = document.createDocumentFragment();
      snap.forEach(doc => {
        const card = $$new("article",
          "bg-white rounded shadow p-4 space-y-1 hover:ring ring-blue-100");
        card.innerHTML = renderThreadCard(doc.id, doc.data());
        frag.appendChild(card);
      });
      wrap.appendChild(frag);
    }
  } catch (err) {
    console.error("❌ Failed to load threads:", err);
    wrap.innerHTML = `<div class="text-red-600">
                        Error loading threads. Please refresh.</div>`;
  }
});
