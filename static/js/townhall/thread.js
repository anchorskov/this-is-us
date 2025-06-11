/* ──────────────────────────────────────────────────────────────
   static/js/townhall/thread.js
   Single-thread view controller  (/townhall/thread/?id=<docID>)
   – Realtime updates
   – Optimistic reply posting
   – Minimal DOM helpers (no frameworks)
   – Zero external deps except Firebase + Tailwind for styles
   ──────────────────────────────────────────────────────────── */

console.log("🧵 townhall/thread.js loaded");

const qs       = (sel, par = document) => par.querySelector(sel);
const $$       = (tag, cls = "") => { const e = document.createElement(tag); e.className = cls; return e; };
const niceDate = ts => ts?.toDate ? ts.toDate().toLocaleString() : "—";

let db, threadId;

/* ─── Early sanity checks ─────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  const wrap = qs("#thread-container");
  if (!wrap) return console.warn("🧵 No #thread-container on page.");
  if (typeof firebase === "undefined" || !firebase.firestore) {
    wrap.innerHTML = `<p class="text-red-600">Firebase not available.</p>`;
    return;
  }
  db = firebase.firestore();

  // Extract threadId from query string (fallback to path segment)
  const params = new URLSearchParams(window.location.search);
  threadId      = params.get("id") || location.pathname.split("/").filter(Boolean).pop();
  console.log("📌 threadId:", threadId);
  if (!threadId) {
    wrap.innerHTML = `<p class="text-red-600">Invalid thread ID.</p>`;
    return;
  }

  renderSkeleton(wrap);
  streamThread(wrap);
  streamReplies();
  wireReplyForm();
});

/* ─── Skeleton while loading ──────────────────────────────── */
function renderSkeleton(wrap) {
  wrap.innerHTML = `
    <div class="p-6 bg-white rounded shadow space-y-4 animate-pulse">
      <div class="h-6 w-3/4 bg-gray-200 rounded"></div>
      <div class="h-4 w-full bg-gray-200 rounded"></div>
      <div class="h-4 w-5/6 bg-gray-200 rounded"></div>
      <div class="h-4 w-2/3 bg-gray-200 rounded mt-6"></div>
    </div>`;
}

/* ─── Thread header (one-shot) ────────────────────────────── */
function streamThread(wrap) {
  db.collection("townhall_threads").doc(threadId)
    .onSnapshot(doc => {
      if (!doc.exists) {
        wrap.innerHTML = `<p class="text-gray-600">Thread not found.</p>`;
        return;
      }
      const t = doc.data();
      wrap.innerHTML = `
        <div class="p-6 bg-white rounded shadow space-y-6">
          <header class="space-y-2">
            <h1 class="text-2xl font-bold">${t.title || "Untitled"}</h1>
            <p class="text-gray-700 whitespace-pre-line">${t.body || ""}</p>
            <p class="text-sm text-gray-500">
              📍 ${t.location || "Unknown"} • 🕒 ${niceDate(t.timestamp)}
            </p>
          </header>

          <section id="reply-list" class="space-y-4 border-t pt-4">
            <p class="text-gray-500">Loading replies…</p>
          </section>

          <form id="reply-form" class="space-y-2 border-t pt-4">
            <input  name="name"    placeholder="Your name"
                    class="border p-2 rounded w-full" required />
            <textarea name="content" placeholder="Your reply…"
                      class="border p-2 rounded w-full" rows="3" required></textarea>
            <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Reply
            </button>
          </form>
        </div>`;
    }, err => {
      console.error("❌ Thread listener error:", err);
      wrap.innerHTML = `<p class="text-red-600">Error loading thread.</p>`;
    });
}

/* ─── Realtime replies ------------------------------------- */
function streamReplies() {
  const list = qs("#reply-list");
  if (!list) return;

  db.collection(`townhall_threads/${threadId}/replies`)
    .orderBy("timestamp", "asc")
    .onSnapshot(snap => {
      // Clear and then repopulate
      list.innerHTML = snap.empty
        ? `<p class="text-gray-400">No replies yet.</p>`
        : "";

      snap.forEach(doc => {
        const r = doc.data();
        const container = $$("div", "border-l-2 pl-3 space-y-1");
        container.innerHTML = `
          <p class="font-medium">${r.displayName || "Anonymous"}:</p>
          <p>${r.content}</p>
          <p class="text-xs text-gray-500">🕒 ${niceDate(r.timestamp)}</p>
        `;
        list.appendChild(container);
      });
    }, err => {
      console.error("❌ Replies listener error:", err);
    });
}

/* ─── Reply form ------------------------------------------- */
function wireReplyForm() {
  document.addEventListener("submit", async evt => {
    if (!evt.target.matches("#reply-form")) return;
    evt.preventDefault();

    const form    = evt.target;
    const name    = form.name.value.trim();
    const content = form.content.value.trim();
    if (!name || !content) {
      alert("Fill out both fields 🙂");
      return;
    }

    const user = firebase.auth().currentUser;
    if (!user) {
      alert("Please sign in first.");
      return;
    }

    // Optimistic UI
    const btn = form.querySelector("button");
    btn.disabled = true;

    try {
      const repliesRef = db.collection(`townhall_threads/${threadId}/replies`);
      await repliesRef.add({
        displayName : name,
        content     : content,
        uid         : user.uid,
        timestamp   : firebase.firestore.FieldValue.serverTimestamp()
      });

      // Increment replyCount for trending
      await db.runTransaction(tx =>
        tx.update(
          db.collection("townhall_threads").doc(threadId),
          { replyCount: firebase.firestore.FieldValue.increment(1) }
        )
      );

      form.reset();
    } catch (err) {
      console.error("❌ Reply error:", err);
      alert("Couldn’t post reply – try again.");
    } finally {
      btn.disabled = false;
    }
  });
}
