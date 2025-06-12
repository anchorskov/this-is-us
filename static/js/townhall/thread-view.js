/* ──────────────────────────────────────────────────────────────
   static/js/townhall/thread-view.js
   Single-thread view controller – Firestore read/write only
   (/townhall/thread/?id=<docID>)
   – Realtime updates
   – Optimistic reply posting
   – Minimal DOM helpers (no frameworks)
   – Zero external deps except Firebase + Tailwind for styles
   – Comments and replies managed entirely in Firestore
────────────────────────────────────────────────────────────── */

console.log("🧵 townhall/thread-view.js loaded");

const qs       = (sel, par = document) => par.querySelector(sel);
const $$       = (tag, cls = "") => { const e = document.createElement(tag); e.className = cls; return e; };
const niceDate = ts => ts?.toDate ? ts.toDate().toLocaleString() : "—";
let db, threadId;
let unsubscribeThread = null;
let unsubscribeReplies = null;

// Firestore collection helpers
const THREADS = () => db.collection("townhall_threads");
const REPLIES = id => THREADS().doc(id).collection("replies");

document.addEventListener("DOMContentLoaded", () => {
  const wrap = qs("#thread-container");
  if (!wrap) return console.warn("🧵 No #thread-container on page.");
  if (!window.firebase || !firebase.firestore) {
    wrap.innerHTML = `<p class="text-red-600">Firebase not available.</p>`;
    return;
  }

  db = firebase.firestore();

  // Extract threadId from query string or path
  const params = new URLSearchParams(window.location.search);
  threadId = params.get("id") || location.pathname.split("/").filter(Boolean).pop();
  if (!threadId) {
    wrap.innerHTML = `<p class="text-red-600">Invalid thread ID.</p>`;
    return;
  }

  renderSkeleton(wrap);

  // Subscribe to thread document
  unsubscribeThread && unsubscribeThread();
  unsubscribeThread = THREADS()
    .doc(threadId)
    .onSnapshot(doc => {
      if (!doc.exists) {
        wrap.innerHTML = `<p class="text-gray-600">Thread not found.</p>`;
        return;
      }

      // Render thread + reply-list + form
      wrap.innerHTML = renderThreadHTML(doc.data());
      const replyList = wrap.querySelector("#reply-list");
      const replyForm = wrap.querySelector("#reply-form");

      // Subscribe to replies (realtime)
      unsubscribeReplies && unsubscribeReplies();
      unsubscribeReplies = REPLIES(threadId)
        .orderBy("timestamp", "asc")
        .onSnapshot(
          snap => renderReplies(snap, replyList),
          err => {
            console.error("❌ Replies listener error:", err);
            showError(wrap, "Error loading replies.");
          }
        );

      // Wire up the reply form
      wireReplyForm(replyForm, replyList);
    }, err => {
      console.error("❌ Thread listener error:", err);
      wrap.innerHTML = `<p class="text-red-600">Error loading thread.</p>`;
    });
});

// Clean up listeners when navigating away
window.addEventListener("beforeunload", () => {
  unsubscribeThread && unsubscribeThread();
  unsubscribeReplies && unsubscribeReplies();
});

function renderSkeleton(wrap) {
  wrap.innerHTML = `
    <div class="p-6 bg-white rounded shadow space-y-4 animate-pulse">
      <div class="h-6 w-3/4 bg-gray-200 rounded"></div>
      <div class="h-4 w-full bg-gray-200 rounded"></div>
      <div class="h-4 w-5/6 bg-gray-200 rounded"></div>
      <div class="h-4 w-2/3 bg-gray-200 rounded mt-6"></div>
    </div>`;
}

function renderThreadHTML(t) {
  // Escape text to avoid injection
  const esc = str => String(str).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]
  );

  return `
    <div class="p-6 bg-white rounded shadow space-y-6">
      <header class="space-y-2">
        <h1 class="text-2xl font-bold">${esc(t.title || "Untitled")}</h1>
        <p class="text-gray-700 whitespace-pre-line">${esc(t.body || "")}</p>
        <p class="text-sm text-gray-500">
          📍 ${esc(t.location || "Unknown")} • 🕒 ${niceDate(t.timestamp)}
        </p>
      </header>

      <section id="reply-list" class="space-y-4 border-t pt-4">
        <p class="text-gray-500">Loading replies…</p>
      </section>

      <form id="reply-form" class="space-y-2 border-t pt-4">
        <input name="name" placeholder="Your name"
               class="border p-2 rounded w-full" required />
        <textarea name="content" placeholder="Your reply…"
                  class="border p-2 rounded w-full" rows="3" required></textarea>
        <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Reply
        </button>
      </form>
    </div>`;
}

function renderReplies(snap, list) {
  list.innerHTML = "";
  if (snap.empty) {
    list.innerHTML = `<p class="text-gray-400">No replies yet.</p>`;
    return;
  }

  snap.forEach(doc => {
    const r = doc.data();
    const div = $$("div", "border-l-2 pl-3 space-y-1");

    const nameEl = document.createElement("p");
    nameEl.className = "font-medium";
    nameEl.textContent = r.displayName || "Anonymous";

    const contentEl = document.createElement("p");
    contentEl.textContent = r.content;

    const timeEl = document.createElement("p");
    timeEl.className = "text-xs text-gray-500";
    timeEl.textContent = `🕒 ${niceDate(r.timestamp)}`;

    div.append(nameEl, contentEl, timeEl);
    list.appendChild(div);
  });
}

function wireReplyForm(form, list) {
  // Remove any existing listener
  form.replaceWith(form.cloneNode(true));
  form = qs("#reply-form", document);

  form.addEventListener("submit", async evt => {
    evt.preventDefault();
    const name    = form.name.value.trim();
    const content = form.content.value.trim();

    if (!name || !content) {
      return showError(form, "Fill out both fields 😊");
    }

    const user = firebase.auth().currentUser;
    if (!user) {
      return showError(form, "Please sign in first.");
    }

    const btn = form.querySelector("button");
    btn.disabled = true;

    // Optimistic placeholder
    const placeholder = $$("div", "border-l-2 pl-3 italic text-gray-500");
    placeholder.textContent = "Sending…";
    list.appendChild(placeholder);

    try {
      // Add reply doc
      await REPLIES(threadId).add({
        displayName: name,
        content,
        uid: user.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Increment replyCount in thread
      await db.runTransaction(tx =>
        tx.update(
          THREADS().doc(threadId),
          { replyCount: firebase.firestore.FieldValue.increment(1) }
        )
      );

      form.reset();
    } catch (err) {
      console.error("❌ Reply error:", err);
      list.removeChild(placeholder);
      showError(form, "Couldn’t post reply – try again.");
    } finally {
      btn.disabled = false;
    }
  });
}

function showError(el, msg) {
  let banner = el.querySelector(".error-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.className = "error-banner bg-red-100 text-red-700 p-2 rounded mb-2";
    el.prepend(banner);
  }
  banner.textContent = msg;
}
