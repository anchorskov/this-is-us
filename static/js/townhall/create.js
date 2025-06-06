// /static/js/townhall/create.js
console.log("📝 Town Hall Create Thread JS loaded");

let db;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("new-thread-form");

  if (!form) {
    console.warn("📭 No new thread form found.");
    return;
  }

  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error("❌ Firebase or Firestore not available.");
    form.innerHTML = `<div class="text-red-600">⚠️ Firebase not loaded. Thread creation unavailable.</div>`;
    return;
  }

  db = firebase.firestore();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("new-title")?.value.trim();
    const body = document.getElementById("new-body")?.value.trim();
    const location = document.getElementById("filter-location")?.value.trim();
    const topic = document.getElementById("filter-topic")?.value.trim();

    if (!title || !body) {
      alert("Please provide both a title and a message.");
      return;
    }

    try {
      const user = firebase.auth().currentUser;
      if (!user) {
        alert("You must be signed in to post.");
        return;
      }

      await db.collection("townhall_threads").add({
        title,
        body,
        location: location || "Unknown",
        topic: topic || "General",
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        authorUid: user.uid,
      });

      alert("✅ Thread submitted!");
      form.reset();
      window.location.href = "/townhall/threads/";
    } catch (err) {
      console.error("❌ Error submitting thread:", err);
      alert("An error occurred while submitting your thread.");
    }
  });
});
