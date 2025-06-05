// static/js/reply-form.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reply-form");
  if (!form) return;

  const textarea = document.getElementById("reply-content");
  const feedback = document.getElementById("reply-feedback");
  const threadId = form.dataset.threadId;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = firebase.auth().currentUser;

    if (!user) {
      feedback.textContent = "You must be signed in.";
      feedback.style.display = "block";
      return;
    }

    const replyData = {
      content: textarea.value.trim(),
      createdBy: user.uid,
      createdAt: new Date().toISOString()
    };

    try {
      await firebase.firestore()
        .collection("threads")
        .doc(threadId)
        .collection("replies")
        .add(replyData);

      textarea.value = "";
      feedback.textContent = "Reply posted!";
      feedback.style.display = "block";
    } catch (err) {
      console.error("Error posting reply:", err);
      feedback.textContent = "Failed to post reply.";
      feedback.style.display = "block";
    }
  });
});
