/* static/js/townhall/thread-view.js
   ------------------------------------------------------------------
   Single-thread controller (modular version)
   ------------------------------------------------------------------ */

console.log("🧵 Modular thread-view.js loaded");

/* ─── Helpers & sub-modules ─────────────────────────────────────── */
import { qs, $$, niceDate }           from "./thread/dom-utils.js";
import {
  initFirestore,      //  ❇️  NEW
  THREADS,
  REPLIES
}                                    from "./thread/firestore-helpers.js";
import {
  renderSkeleton,
  renderThreadHTML
}                                    from "./thread/render-thread.js";
import { renderReplies }             from "./thread/reply-renderer.js";
import { wireReplyForm }             from "./thread/reply-form-handler.js";
import { showError }                 from "./thread/error-banner.js";

/* ─── State ─────────────────────────────────────────────────────── */
let threadId,
    unsubscribeThread  = null,
    unsubscribeReplies = null,
    currentUser        = null;

/* ─── Main bootstrap ────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  const wrap = qs("#thread-container");
  if (!wrap) {
    console.warn("🧵 No #thread-container on page.");
    return;
  }
  if (!window.firebase || !firebase.firestore || !firebase.auth) {
    wrap.innerHTML =
      `<p class="text-red-600">
         Firebase not available. Ensure Firebase SDKs are loaded.
       </p>`;
    return;
  }

  /* 1.  Initialise Firestore for helper modules —–––––––––––––––– */
  const db = firebase.firestore();
  initFirestore(db);                     //  ←  Important!

  /* 2.  Auth state listener (unchanged) —––––––––––––––––––––––– */
firebase.auth().onAuthStateChanged(async user => {
  currentUser = user;

  /* ─── Auto-populate “Your name” field ─── */
  const form = document.querySelector("#reply-form");
  const nameInput = form?.elements?.name;       // <input name="name">
  const replyButton = form?.querySelector("button[type='submit']");
  const noticeId = "verification-notice";

  if (nameInput) {
    nameInput.value    = user?.displayName || "";
    nameInput.readOnly = !!user?.displayName;   // lock if we have a name
  }

  // Remove any previous notice banner
  document.getElementById(noticeId)?.remove();
  if (!form || !replyButton) return;

  /* ─── Verified-user gating ─── */
  if (user) {
    try {
      const snap     = await db.collection("users").doc(user.uid).get();
      const verified = snap.exists && snap.data().verified === true;

      if (!verified) {
        replyButton.disabled = true;
        replyButton.classList.add("opacity-50", "cursor-not-allowed");

        const msg = document.createElement("div");
        msg.id = noticeId;
        msg.className = "text-yellow-700 bg-yellow-100 p-2 rounded text-sm mt-2";
        msg.innerHTML =
          `⚠️ You must <strong>verify your account</strong> to post a reply.
           <a href="/account"
              class="underline text-blue-600 hover:text-blue-800">
           Request verification</a>.`;
        form.appendChild(msg);
      } else {
        replyButton.disabled = false;
        replyButton.classList.remove("opacity-50", "cursor-not-allowed");
      }

    } catch (err) {
      console.error("Verification lookup failed:", err);
      showError(form, "Verification check failed.");
    }

  } else {
    // Not signed in
    replyButton.disabled = true;
    replyButton.classList.add("opacity-50", "cursor-not-allowed");

    const msg = document.createElement("div");
    msg.id = noticeId;
    msg.className = "text-gray-600 text-sm mt-2";
    msg.innerHTML =
      `🔐 Please <a href="/login"
          class="underline text-blue-600 hover:text-blue-800">
       sign in</a> to post a reply.`;
    form.appendChild(msg);
  }
});

  /* 3.  Resolve threadId from query/path —–––––––––––––––––––––– */
  const params = new URLSearchParams(location.search);
  threadId = params.get("id") ||
             location.pathname.split("/").filter(Boolean).pop();

  if (!threadId) {
    wrap.innerHTML = `<p class="text-red-600">Invalid thread ID.</p>`;
    return;
  }

  /* 4.  Skeleton UI then realtime listeners —––––––––––––––––––– */
  renderSkeleton(wrap);

  unsubscribeThread = THREADS().doc(threadId).onSnapshot(doc => {
    if (!doc.exists) {
      wrap.innerHTML =
        `<p class="text-gray-600">Thread not found or you lack permission.</p>`;
      return;
    }

    wrap.innerHTML = renderThreadHTML(doc.data(), niceDate);

    qs("#back-to-townhall-btn")?.addEventListener(
      "click", () => (location.href = "/townhall/threads/"));

    const list = qs("#reply-list");
    const form = qs("#reply-form");

    unsubscribeReplies?.();
    unsubscribeReplies = REPLIES(threadId)
      .orderBy("timestamp","asc")
      .onSnapshot(
        snap => renderReplies(snap, list, currentUser),
        err  => { console.error("Replies error:", err);
                  showError(wrap,"Error loading replies."); }
      );

    wireReplyForm(form, list, threadId, currentUser, db);
  }, err => {
    console.error("Thread listener error:", err);
    wrap.innerHTML = `<p class="text-red-600">Error loading thread.</p>`;
  });
});

/* ─── Clean-up ────────────────────────────────────────────────── */
window.addEventListener("beforeunload", () => {
  unsubscribeThread?.();
  unsubscribeReplies?.();
});
