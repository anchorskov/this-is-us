console.log("🆕 create-thread.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const form      = document.getElementById("new-thread-form");
  const feedback  = document.getElementById("create-thread-feedback");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { title, location, body } = Object.fromEntries(new FormData(form));

    const user = firebase.auth().currentUser;
    if (!user) {
      feedback.textContent = "🔐 Please sign in first.";
      feedback.className   = "text-red-600 mt-2";
      feedback.hidden      = false;
      return;
    }

    /* Firestore add */
    try {
      await firebase.firestore()
        .collection("townhall_threads")
        .add({
          title, body, location,
          createdBy : user.uid,
          timestamp : firebase.firestore.FieldValue.serverTimestamp(),
          replyCount: 0,
        });

      feedback.textContent = "✅ Thread published!";
      feedback.className   = "text-green-600 mt-2";
      feedback.hidden      = false;

      // Optionally redirect to Town-Hall list
      setTimeout(() => location.href = "/townhall/threads/", 800);
    } catch (err) {
      console.error(err);
      feedback.textContent = "❌ Error publishing thread.";
      feedback.className   = "text-red-600 mt-2";
      feedback.hidden      = false;
    }
  });
});
