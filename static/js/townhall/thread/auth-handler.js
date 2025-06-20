// static/js/townhall/thread/auth-handler.js

import { getFirestoreInstance } from "./firestore-helpers.js";
import { renderReplies } from "./reply-renderer.js";
import { REPLIES } from "./firestore-helpers.js";
import { showError } from "./dom-utils.js";

export let currentUser = null;

export function listenForAuthState(threadId) {
  firebase.auth().onAuthStateChanged(async user => {
    currentUser = user;

    const form = document.querySelector("#reply-form");
    const replyButton = form?.querySelector("button[type='submit']");
    const verificationNoticeId = "verification-notice";

    const existingNotice = document.getElementById(verificationNoticeId);
    if (existingNotice) existingNotice.remove();

    if (!form || !replyButton) return;

    if (user) {
      try {
        const db = getFirestoreInstance();
        const userDoc = await db.collection("users").doc(user.uid).get();
        const isVerified = userDoc.exists && userDoc.data().verified === true;

        if (!isVerified) {
          disableReply(replyButton, form, verificationNoticeId);
        } else {
          enableReply(replyButton);
        }

        const replyList = document.querySelector("#reply-list");
        if (threadId && replyList) {
          const snap = await REPLIES(threadId).orderBy("timestamp", "asc").get();
          renderReplies(snap, replyList, currentUser);
        }

      } catch (err) {
        console.error("Error checking verification status:", err);
        showError(form, "Verification check failed.");
      }
    } else {
      disableReply(replyButton, form, verificationNoticeId, true);
    }
  });
}

function disableReply(button, form, noticeId, unauthenticated = false) {
  button.disabled = true;
  button.classList.add("opacity-50", "cursor-not-allowed");

  const msg = document.createElement("div");
  msg.id = noticeId;
  msg.className = unauthenticated
    ? "text-gray-600 text-sm mt-2"
    : "text-yellow-700 bg-yellow-100 p-2 rounded text-sm mt-2";

  msg.innerHTML = unauthenticated
    ? `🔐 Please <a href="/login" class="underline text-blue-600 hover:text-blue-800">sign in</a> to post a reply.`
    : `⚠️ You must <strong>verify your account</strong> to post a reply.
       <a href="/account" class="underline text-blue-600 hover:text-blue-800">Request verification</a>.`;

  form.appendChild(msg);
}

function enableReply(button) {
  button.disabled = false;
  button.classList.remove("opacity-50", "cursor-not-allowed");
}
