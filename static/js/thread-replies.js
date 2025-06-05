// /static/js/thread-replies.js
console.log("💬 thread-replies.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const db = firebase.firestore();

  // Attach replies UI under each thread (after threads are rendered)
  const threadList = document.getElementById("thread-list");
  const replyFormTemplate = document.getElementById("reply-form-template");
  const replyListTemplate = document.getElementById("reply-list-template");

  const renderReplies = async (threadId, container) => {
    const repliesRef = db.collection("threads").doc(threadId).collection("replies").orderBy("createdAt", "asc");
    const snapshot = await repliesRef.get();

    container.innerHTML = "";
    snapshot.forEach(doc => {
      const reply = doc.data();
      const div = document.createElement("div");
      div.className = "border border-gray-200 p-2 rounded bg-gray-50";
      div.innerHTML = `<strong>${reply.displayName || "Anonymous"}:</strong> ${reply.content}`;
      container.appendChild(div);
    });
  };

  const attachReplyForm = (threadId, threadEl) => {
    const replyForm = replyFormTemplate.content.cloneNode(true);
    const repliesWrapper = document.createElement("div");
    repliesWrapper.appendChild(replyForm);

    const repliesContainer = document.createElement("div");
    repliesContainer.className = "mt-2 space-y-2 text-sm text-gray-800";

    repliesWrapper.appendChild(repliesContainer);
    threadEl.appendChild(repliesWrapper);

    // Load existing replies
    renderReplies(threadId, repliesContainer);

    const form = repliesWrapper.querySelector("form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const textarea = form.querySelector("textarea");
      const content = textarea.value.trim();
      textarea.value = "";

      const user = firebase.auth().currentUser;
      if (!user) return alert("You must be signed in to reply.");

      const userDoc = await db.collection("users").doc(user.uid).get();
      const displayName = userDoc.exists ? userDoc.data().displayName : "Anonymous";

      await db.collection("threads").doc(threadId).collection("replies").add({
        content,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        uid: user.uid,
        displayName
      });

      renderReplies(threadId, repliesContainer);
    });
  };

  // Wait for threads to be rendered before attaching
  const observer = new MutationObserver(() => {
    const threadCards = threadList.querySelectorAll("[data-thread-id]");
    threadCards.forEach(card => {
      if (!card.dataset.repliesAttached) {
        const threadId = card.dataset.threadId;
        attachReplyForm(threadId, card);
        card.dataset.repliesAttached = "true";
      }
    });
  });

  observer.observe(threadList, { childList: true });
});
