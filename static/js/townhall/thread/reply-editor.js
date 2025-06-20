// static/js/townhall/thread/reply-editor.js

import { $$ } from "./dom-utils.js";
import { REPLIES } from "./firestore-helpers.js";
import { showError } from "./error-banner.js";

export function startEditReply(replyId, currentContent, replyElement, threadId) {
  const contentParagraph = replyElement.querySelector(".reply-content");
  if (!contentParagraph) return;

  const textarea = $$("textarea", "border p-2 rounded w-full focus:ring-blue-500 focus:border-blue-500");
  textarea.value = currentContent;
  textarea.rows = 3;

  const saveBtn = $$("button", "bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm mr-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2");
  saveBtn.textContent = "Save";

  const cancelBtn = $$("button", "bg-gray-400 text-white px-3 py-1 rounded hover:bg-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2");
  cancelBtn.textContent = "Cancel";

  const buttonDiv = $$("div", "mt-2");
  buttonDiv.append(saveBtn, cancelBtn);

  replyElement.replaceChild(textarea, contentParagraph);
  replyElement.appendChild(buttonDiv);
  textarea.focus();

  saveBtn.addEventListener("click", async () => {
    const newContent = textarea.value.trim();
    if (newContent && newContent !== currentContent) {
      try {
        await REPLIES(threadId).doc(replyId).update({ content: newContent });
      } catch (err) {
        console.error("❌ Error updating reply:", err);
        showError(replyElement, "Could not update reply.");
      }
    }
    revertToDisplayMode(newContent);
  });

  cancelBtn.addEventListener("click", () => revertToDisplayMode());

  function revertToDisplayMode(newValue = null) {
    const newContentParagraph = $$("p", "reply-content");
    newContentParagraph.textContent = newValue?.trim() || currentContent;
    replyElement.replaceChild(newContentParagraph, textarea);
    buttonDiv.remove();
  }
}
