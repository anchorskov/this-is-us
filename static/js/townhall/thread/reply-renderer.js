// static/js/townhall/thread/reply-renderer.js

import { $$, niceDate } from "./dom-utils.js";
import { startEditReply } from "./reply-editor.js";

export function renderReplies(snap, list, currentUser) {
  list.innerHTML = "";
  if (snap.empty) {
    list.innerHTML = `<p class="text-gray-400">No replies yet.</p>`;
    return;
  }

  snap.forEach(doc => {
    const r = doc.data();
    const replyId = doc.id;
    const div = $$("div", "border-l-2 pl-3 space-y-1");
    div.id = `reply-${replyId}`;

    const nameEl = document.createElement("p");
    nameEl.className = "font-medium";
    nameEl.textContent = r.displayName || "Anonymous";

    const contentEl = document.createElement("p");
    contentEl.className = "reply-content";
    contentEl.textContent = r.content;

    // Enable double-click editing
    contentEl.addEventListener("dblclick", () => {
      if (currentUser && currentUser.uid === r.uid) {
        startEditReply(replyId, r.content, div);
      }
    });

    const timeEl = document.createElement("p");
    timeEl.className = "text-xs text-gray-500";
    timeEl.textContent = `🕒 ${niceDate(r.timestamp)}`;

    if (currentUser && currentUser.uid === r.uid) {
      const editBtn = $$("button", "text-blue-500 hover:text-blue-700 text-sm ml-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2");
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => startEditReply(replyId, r.content, div));
      timeEl.append(editBtn);
    }

    div.append(nameEl, contentEl, timeEl);
    list.appendChild(div);
  });
}
