// static/js/townhall/thread-view.js
console.log("🧵 thread-view.js loaded (D1/Worker)");

import { qs, $$, niceDate } from "./thread/dom-utils.js";
import { renderSkeleton, renderThreadHTML } from "./thread/render-thread.js";
import { renderReplies } from "./thread/reply-renderer.js";
import { showError } from "./thread/error-banner.js";

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

let threadId;
let currentUser = null;
let repliesCache = [];

async function fetchThread(id) {
  const res = await fetch(`/api/townhall/posts/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Thread fetch failed (${res.status})`);
  return res.json();
}

async function postReply(id, user, body) {
  if (!user) throw new Error("Unauthorized");
  const token = await user.getIdToken();
  const res = await fetch(`/api/townhall/posts/${encodeURIComponent(id)}/replies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(errText || `Reply failed (${res.status})`);
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

function wireReplyForm(form, list) {
  if (!form) return;
  const textarea = form.querySelector("textarea[name='body']");
  const btn = form.querySelector("button[type='submit']");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!textarea) return;
    const body = textarea.value.trim();
    if (!body) return;
    if (!currentUser) {
      showError(form, "Sign in to reply.");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Posting…";
    try {
      const reply = await postReply(threadId, currentUser, body);
      repliesCache.push({
        id: reply.id,
        data: () => ({
          uid: reply.author_user_id,
          content: reply.body,
          timestamp: reply.created_at,
          displayName: reply.author_user_id || "",
        }),
      });
      const snap = {
        empty: repliesCache.length === 0,
        forEach: (fn) => repliesCache.forEach((doc) => fn(doc)),
      };
      renderReplies(snap, list, currentUser);
      textarea.value = "";
    } catch (err) {
      console.error("Reply error:", err);
      const msg = err.responseMessage || err.message || "Reply failed";
      showError(form, msg);
    } finally {
      btn.disabled = false;
      btn.textContent = "Post reply";
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const wrap = qs("#thread-container");
  if (!wrap) return;

  const auth = getAuth();
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
  });

  const params = new URLSearchParams(location.search);
  threadId = params.get("id") || location.pathname.split("/").filter(Boolean).pop();
  if (!threadId) {
    wrap.innerHTML = `<p class="text-red-600">Invalid thread ID.</p>`;
    return;
  }

  renderSkeleton(wrap);

  try {
    const data = await fetchThread(threadId);
    const t = data.thread || {};
    const viewThread = {
      title: t.title,
      body: t.prompt,
      location: t.county || "County",
      timestamp: t.created_at || t.createdAt,
    };
    wrap.innerHTML = renderThreadHTML(viewThread, niceDate);

    const list = qs("#reply-list");
    repliesCache = (data.replies || []).map((r) => ({
      id: r.id,
      data: () => ({
        uid: r.author_user_id,
        content: r.body,
        timestamp: r.created_at,
        displayName: r.author_user_id || "",
      }),
    }));
    const snap = {
      empty: repliesCache.length === 0,
      forEach: (fn) => repliesCache.forEach((doc) => fn(doc)),
    };
    renderReplies(snap, list, currentUser);

    const form = qs("#reply-form");
    wireReplyForm(form, list);
  } catch (err) {
    console.error("Thread fetch error:", err);
    wrap.innerHTML = `<p class="text-red-600">Error loading thread.</p>`;
  }
});
