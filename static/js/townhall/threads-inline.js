// 📁 static/js/townhall/threads-inline.js
// Extends threads.js with inline thread expansion

console.log("📂 threads-inline.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("threads-container");
  if (!list) return console.warn("🔕 #threads-container missing");

  const db = firebase.firestore();
  const PAGE = 15;
  let lastSnap = null;

  async function loadMore() {
    let q = db.collection("townhall_threads")
              .orderBy("timestamp", "desc")
              .limit(PAGE);

    if (lastSnap) q = q.startAfter(lastSnap);
    const snap = await q.get();
    if (snap.empty) return;

    snap.forEach(doc => {
      const thread = doc.data();
      const safeId = encodeURIComponent(doc.id);
      const card = document.createElement("article");
      card.className = "bg-white rounded shadow p-4 space-y-2";

      const header = `<h3 class="font-semibold text-lg">${thread.title ?? "Untitled"}</h3>
        <p class="text-sm text-gray-600 line-clamp-3">${thread.body ?? ""}</p>
        <p class="text-xs text-gray-500">📍 ${thread.location ?? "Unknown"} • 🕒 ${thread.timestamp?.toDate().toLocaleString()}</p>`;

      const toggleBtn = document.createElement("button");
      toggleBtn.textContent = "▼ View Thread";
      toggleBtn.className = "text-blue-600 hover:underline text-sm";

      const threadWrap = document.createElement("div");
      threadWrap.id = `thread-${safeId}`;
      threadWrap.className = "mt-4 space-y-4 hidden";

      toggleBtn.addEventListener("click", () => {
        threadWrap.classList.toggle("hidden");
        if (!threadWrap.hasChildNodes()) {
          renderThreadView(doc.id, threadWrap);
        }
      });

      card.innerHTML = header;
      card.append(toggleBtn, threadWrap);
      list.appendChild(card);
    });

    lastSnap = snap.docs[snap.docs.length - 1];
  }

  async function renderThreadView(threadId, wrap) {
    const doc = await db.collection("townhall_threads").doc(threadId).get();
    if (!doc.exists) {
      wrap.innerHTML = `<p class='text-red-600'>Thread not found.</p>`;
      return;
    }

    const t = doc.data();
    const replyList = document.createElement("section");
    replyList.id = `reply-list-${threadId}`;
    replyList.className = "space-y-2 border-t pt-3";
    replyList.textContent = "Loading replies…";

    const replyForm = document.createElement("form");
    replyForm.className = "space-y-2 border-t pt-3";
    replyForm.innerHTML = `
      <input name="name" placeholder="Your name" class="border p-2 rounded w-full" required />
      <textarea name="content" placeholder="Your reply…" class="border p-2 rounded w-full" rows="3" required></textarea>
      <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Reply</button>`;

    replyForm.addEventListener("submit", async e => {
      e.preventDefault();
      const name = replyForm.name.value.trim();
      const content = replyForm.content.value.trim();
      if (!name || !content) return;
      const user = firebase.auth().currentUser;
      if (!user) return;
      await db.collection("townhall_threads")
              .doc(threadId)
              .collection("replies")
              .add({
                displayName: name,
                content,
                uid: user.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
              });
      replyForm.reset();
    });

    db.collection("townhall_threads")
      .doc(threadId)
      .collection("replies")
      .orderBy("timestamp", "asc")
      .onSnapshot(snap => {
        replyList.innerHTML = "";
        if (snap.empty) {
          replyList.textContent = "No replies yet.";
          return;
        }
        snap.forEach(doc => {
          const r = doc.data();
          const div = document.createElement("div");
          div.className = "border-l-2 pl-2";
          div.innerHTML = `<p class='font-medium'>${r.displayName || "Anon"}</p>
                           <p>${r.content}</p>
                           <p class='text-xs text-gray-500'>🕒 ${r.timestamp?.toDate().toLocaleString()}</p>`;
          replyList.appendChild(div);
        });
      });

    wrap.innerHTML = `<p class="whitespace-pre-line">${t.body}</p>`;
    wrap.append(replyList, replyForm);
  }

  loadMore();
});
