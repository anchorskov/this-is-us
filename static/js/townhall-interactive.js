// /static/js/townhall-interactive.js
console.log("🧠 Interactive Town Hall JS loaded");

let db;

document.addEventListener("DOMContentLoaded", () => {
  const mapContainer = document.getElementById("townhall-map");
  if (mapContainer) {
    const map = L.map("townhall-map").setView([42.8666, -106.3131], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    L.marker([42.8666, -106.3131])
      .addTo(map)
      .bindPopup("📍 Casper Town Hall")
      .openPopup();
    console.log("🗺️ Leaflet map initialized.");
  } else {
    console.warn("📍 No map container found.");
  }

  const threadList = document.getElementById("thread-list");
  if (!threadList) {
    console.warn("📂 No thread list container found.");
    return;
  }

  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error("❌ Firebase or Firestore not loaded.");
    threadList.innerHTML = `<div class="text-red-600">⚠️ Firebase is not available. Threads cannot be loaded.</div>`;
    return;
  }

  db = firebase.firestore();

  function loadReplies(threadId, container) {
    const replyList = document.createElement("div");
    replyList.className = "pl-4 mt-2 space-y-2 text-sm";
    container.appendChild(replyList);

    db.collection(`threads/${threadId}/replies`)
      .orderBy("timestamp", "asc")
      .get()
      .then((snapshot) => {
        if (snapshot.empty) {
          replyList.innerHTML = `<p class="text-gray-400">No replies yet.</p>`;
        } else {
          snapshot.forEach((doc) => {
            const reply = doc.data();
            const time = reply.timestamp?.toDate().toLocaleString() || "Unknown";
            replyList.innerHTML += `
              <div class="border-l-2 pl-2">
                <p class="font-medium">${reply.displayName || "Anonymous"}:</p>
                <p>${reply.content}</p>
                <p class="text-xs text-gray-500">🕒 ${time}</p>
              </div>
            `;
          });
        }
      });
  }

  function loadThreads() {
    db.collection("townhall_threads")
      .orderBy("timestamp", "desc")
      .limit(20)
      .get()
      .then((querySnapshot) => {
        threadList.innerHTML = "";
        if (querySnapshot.empty) {
          threadList.innerHTML = `<div class="p-4 border rounded bg-white text-gray-600">🕊️ No conversations yet. Start one below.</div>`;
          return;
        }

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const threadId = doc.id;
          const timestamp = data.timestamp?.toDate
            ? data.timestamp.toDate().toLocaleString()
            : "Unknown time";

          const wrapper = document.createElement("div");
          wrapper.className = "p-4 border rounded shadow-sm bg-white";

          wrapper.innerHTML = `
            <h3 class="font-semibold text-lg">${data.title || "Untitled"}</h3>
            <p class="text-gray-700 mt-2">${data.body || ""}</p>
            <p class="text-sm text-gray-500 mt-2">📍 ${data.location || "Unknown"} • 🕒 ${timestamp}</p>
            <form class="reply-form mt-4 space-y-2">
              <input type="text" placeholder="Your name" class="reply-name border p-1 rounded w-full" required />
              <textarea placeholder="Your reply…" class="reply-content border p-1 rounded w-full" required></textarea>
              <button type="submit" class="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700">Reply</button>
            </form>
          `;

          const replyForm = wrapper.querySelector(".reply-form");
          replyForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const name = replyForm.querySelector(".reply-name").value.trim();
            const content = replyForm.querySelector(".reply-content").value.trim();

            if (!content || !name) {
              alert("Please provide your name and reply.");
              return;
            }

            try {
              const user = firebase.auth().currentUser;
              if (!user) {
                alert("You must be signed in to reply.");
                return;
              }

              await db.collection(`threads/${threadId}/replies`).add({
                displayName: name,
                content,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                uid: user.uid,
              });

              alert("✅ Reply posted!");
              loadThreads(); // reload threads and replies
            } catch (err) {
              console.error("❌ Error submitting reply:", err);
              alert("Error submitting your reply.");
            }
          });

          loadReplies(threadId, wrapper);
          threadList.appendChild(wrapper);
        });
      })
      .catch((err) => {
        console.error("❌ Failed to load threads:", err);
        threadList.innerHTML = `<div class="text-red-600">⚠️ Failed to load threads. Please try again later.</div>`;
      });
  }

  loadThreads();
});

const threadForm = document.getElementById("new-thread-form");
if (threadForm) {
  threadForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("new-title").value.trim();
    const body = document.getElementById("new-body").value.trim();
    const location = document.getElementById("filter-location").value.trim();
    const topic = document.getElementById("filter-topic").value.trim();

    if (!title || !body) {
      alert("Please enter both a title and a message.");
      return;
    }

    try {
      const user = firebase.auth().currentUser;
      if (!user) {
        alert("Please sign in to post.");
        return;
      }

      await db.collection("threads").add({
        title,
        body,
        location: location || "Unknown",
        topic: topic || "General",
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        authorUid: user.uid,
      });

      alert("✅ Thread submitted!");
      threadForm.reset();
      document.dispatchEvent(new Event("DOMContentLoaded")); // Reloads threads
    } catch (err) {
      console.error("❌ Error submitting thread:", err);
      alert("An error occurred while submitting your thread.");
    }
  });
}
