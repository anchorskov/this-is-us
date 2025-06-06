// /static/js/townhall/thread.js
console.log("🧵 Town Hall Thread Detail JS loaded");

let db;
let threadId;

document.addEventListener("DOMContentLoaded", () => {
  const threadContainer = document.getElementById("thread-container");

  if (!threadContainer) {
    console.warn("🧵 No thread container found.");
    return;
  }

  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error("❌ Firebase or Firestore not loaded.");
    threadContainer.innerHTML = `<div class="text-red-600">⚠️ Firebase is not available. Cannot load thread.</div>`;
    return;
  }

  db = firebase.firestore();

  // Extract threadId from URL (assuming /townhall/thread/:id)
  const parts = window.location.pathname.split("/");
  threadId = parts[parts.length - 1];

  if (!threadId) {
    threadContainer.innerHTML = `<div class="text-red-600">⚠️ Invalid thread ID.</div>`;
    return;
  }

  loadThread();
  loadReplies();
  setupReplyForm();
});

function loadThread() {
  const container = document.getElementById("thread-container");

  db.collection("townhall_threads")
    .doc(threadId)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        container.innerHTML = `<div class="text-gray-600">⚠️ Thread not found.</div>`;
        return;
      }

      const data = doc.data();
      const timestamp = data.timestamp?.toDate
        ? data.timestamp.toDate().toLocaleString()
        : "Unknown time";

      container.innerHTML = `
        <div class="p-4 border rounded bg-white shadow-sm space-y-4">
          <h2 class="text-2xl font-bold">${data.title || "Untitled"}</h2>
          <p class="text-gray-700">${data.body || ""}</p>
          <p class="text-sm text-gray-500">📍 ${data.location || "Unknown"} • 🕒 ${timestamp}</p>
          <div id="reply-list" class="space-y-4 pt-4 border-t mt-4"></div>
          <form id="reply-form" class="mt-6 space-y-2">
            <input type="text" placeholder="Your name" class="reply-name border p-1 rounded w-full" required />
            <textarea placeholder="Your reply…" class="reply-content border p-1 rounded w-full" required></textarea>
            <button type="submit" class="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700">Reply</button>
          </form>
        </div>
      `;
    })
    .catch((err) => {
      console.error("❌ Failed to load thread:", err);
      container.innerHTML = `<div class="text-red-600">⚠️ Error loading thread.</div>`;
    });
}

function loadReplies() {
  const replyList = document.getElementById("reply-list");

  db.collection(`townhall_threads/${threadId}/replies`)
    .orderBy("timestamp", "asc")
    .get()
    .then((snapshot) => {
      if (snapshot.empty) {
        replyList.innerHTML = `<p class="text-gray-400">No replies yet.</p>`;
        return;
      }

      replyList.innerHTML = "";

      snapshot.forEach((doc) => {
        const reply = doc.data();
        const time = reply.timestamp?.toDate().toLocaleString() || "Unknown";

        replyList.innerHTML += `
          <div class="border-l-2 pl-3">
            <p class="font-medium">${reply.displayName || "Anonymous"}:</p>
            <p>${reply.content}</p>
            <p class="text-xs text-gray-500">🕒 ${time}</p>
          </div>
        `;
      });
    })
    .catch((err) => {
      console.error("❌ Failed to load replies:", err);
      replyList.innerHTML = `<p class="text-red-600">⚠️ Failed to load replies.</p>`;
    });
}

function setupReplyForm() {
  document.addEventListener("submit", async (e) => {
    if (!e.target.matches("#reply-form")) return;
    e.preventDefault();

    const form = e.target;
    const name = form.querySelector(".reply-name").value.trim();
    const content = form.querySelector(".reply-content").value.trim();

    if (!name || !content) {
      alert("Please fill out both name and reply.");
      return;
    }

    try {
      const user = firebase.auth().currentUser;
      if (!user) {
        alert("You must be signed in to reply.");
        return;
      }

      await db.collection(`townhall_threads/${threadId}/replies`).add({
        displayName: name,
        content,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        uid: user.uid,
      });

      alert("✅ Reply posted!");
      loadReplies();
      form.reset();
    } catch (err) {
      console.error("❌ Failed to post reply:", err);
      alert("An error occurred posting your reply.");
    }
  });
}
