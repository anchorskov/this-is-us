/* ──────────────────────────────────────────────────────────────
   static/js/townhall/thread-view.js
   Single-thread controller – Firebase v9 modular
   ------------------------------------------------------------------ */
console.log("🧵 Modular thread-view.js loaded (v9)");

/* ─── Helpers & sub-modules ───────────────────────────────────── */
import { qs, $$, niceDate }           from "./thread/dom-utils.js";
import {
  initFirestore,        // exposes THREADS() / REPLIES() helpers
  THREADS,
  REPLIES
}                                     from "./thread/firestore-helpers.js";
import {
  renderSkeleton,
  renderThreadHTML
}                                     from "./thread/render-thread.js";
import { renderReplies }              from "./thread/reply-renderer.js";
import { wireReplyForm }              from "./thread/reply-form-handler.js";
import { showError }                  from "./thread/error-banner.js";

/* ─── Firebase v9 imports ────────────────────────────────────── */
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

/* ─── State ──────────────────────────────────────────────────── */
let threadId;
let unsubscribeThread  = null;
let unsubscribeReplies = null;
let currentUser        = null;

/* ─── Main bootstrap ────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  const wrap = qs("#thread-container");
  if (!wrap) {
    console.warn("🧵 No #thread-container on page");
    return;
  }

  /* 1. Initialise Firestore helpers ------------------------- */
  const auth = getAuth();
  const db   = getFirestore();
  initFirestore(db);      // make db available to THREADS()/REPLIES()

  /* 2. Auth state listener ---------------------------------- */
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    /* auto-populate “Your name” ---------------------------- */
    const form         = qs("#reply-form");
    const nameInput    = form?.elements?.name;
    const replyButton  = form?.querySelector("button[type='submit']");
    const noticeId     = "verification-notice";

    if (nameInput) {
      nameInput.value    = user?.displayName || "";
      nameInput.readOnly = !!user?.displayName;
    }

    // clear old notice
    $$("#" + noticeId).forEach((n) => n.remove());
    if (!form || !replyButton) return;

    if (user) {
      try {
        const profileSnap = await getDoc(doc(db, "users", user.uid));
        const verified    = profileSnap.exists() && profileSnap.data().verified;

        if (!verified) {
          replyButton.disabled = true;
          replyButton.classList.add("opacity-50", "cursor-not-allowed");

          const msg         = document.createElement("div");
          msg.id            = noticeId;
          msg.className     = "text-yellow-700 bg-yellow-100 p-2 rounded text-sm mt-2";
          msg.innerHTML =
            `⚠️ You must <strong>verify your account</strong> to post a reply.
             <a href="/account" class="underline text-blue-600 hover:text-blue-800">
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
      replyButton.disabled = true;
      replyButton.classList.add("opacity-50", "cursor-not-allowed");

      const msg       = document.createElement("div");
      msg.id          = noticeId;
      msg.className   = "text-gray-600 text-sm mt-2";
      msg.innerHTML   =
        `🔐 Please <a href="/login"
            class="underline text-blue-600 hover:text-blue-800">
         sign in</a> to post a reply.`;
      form.appendChild(msg);
    }
  });

  /* 3. Resolve threadId ------------------------------------ */
  const params = new URLSearchParams(location.search);
  threadId =
    params.get("id") ||
    location.pathname.split("/").filter(Boolean).pop();

  if (!threadId) {
    wrap.innerHTML = `<p class="text-red-600">Invalid thread ID.</p>`;
    return;
  }

  /* 4. Skeleton + realtime listeners ----------------------- */
  renderSkeleton(wrap);

  unsubscribeThread = THREADS()
    .doc(threadId)
    .onSnapshot(
      (docSnap) => {
        if (!docSnap.exists()) {
          wrap.innerHTML =
            `<p class="text-gray-600">Thread not found or you lack permission.</p>`;
          return;
        }

        wrap.innerHTML = renderThreadHTML(docSnap.data(), niceDate);

        qs("#back-to-townhall-btn")?.addEventListener(
          "click",
          () => (location.href = "/townhall/threads/")
        );

        const list = qs("#reply-list");
        const form = qs("#reply-form");

        // Replies listener
        unsubscribeReplies?.();
        unsubscribeReplies = REPLIES(threadId)
          .orderBy("timestamp", "asc")
          .onSnapshot(
            (snap) => renderReplies(snap, list, currentUser),
            (err)   => {
              console.error("Replies error:", err);
              showError(wrap, "Error loading replies.");
            }
          );

        wireReplyForm(form, list, threadId, currentUser, db);
      },
      (err) => {
        console.error("Thread listener error:", err);
        wrap.innerHTML =
          `<p class="text-red-600">Error loading thread.</p>`;
      }
    );
});

/* ─── Clean-up on page unload ─────────────────────────────── */
window.addEventListener("beforeunload", () => {
  unsubscribeThread?.();
  unsubscribeReplies?.();
});
