// 📁 static/js/townhall/threads-inline.js
// Extends threads.js with inline thread expansion (Firebase v9)

console.log("📂 threads-inline.js loaded (v9)");

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("threads-container");
  if (!list) {
    console.warn("🔕 #threads-container missing");
    return;
  }

  const db   = getFirestore();
  const auth = getAuth();

  const PAGE = 15;
  let lastSnap = null;

  /* ─── Pagination loader ────────────────────────────────── */
  async function loadMore() {
    let q = query(
      collection(db, "townhall_threads"),
      orderBy("timestamp", "desc"),
      limit(PAGE)
    );
    if (lastSnap) q = query(q, startAfter(lastSnap));

    const snap = await getDocs(q);
    if (snap.empty) return;

    snap.forEach((d) => renderThreadCard(d));
    lastSnap = snap.docs[snap.docs.length - 1];
  }

  /* ─── Render one thread card with inline toggle ────────── */
  function renderThreadCard(docSnap) {
    const thread = docSnap.data();
    const id     = docSnap.id;

    const card = document.createElement("article");
    card.className = "bg-white rounded shadow p-4 space-y-2";

    card.innerHTML = `
      <h3 class="font-semibold text-lg">${thread.title ?? "Untitled"}</h3>
      <p class="text-sm text-gray-600 line-clamp-3">${thread.body ?? ""}</p>
      <p class="text-xs text-gray-500">
        📍 ${thread.location ?? "Unknown"} •
        🕒 ${thread.timestamp?.toDate().toLocaleString() ?? ""}
      </p>
    `;

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "▼ View Thread";
    toggleBtn.className   = "text-blue-600 hover:underline text-sm";

    const wrap = document.createElement("div");
    wrap.id    = `thread-${id}`;
    wrap.className = "mt-4 space-y-4 hidden";

    toggleBtn.addEventListener("click", () => {
      wrap.classList.toggle("hidden");
      if (!wrap.hasChildNodes()) renderThreadView(id, wrap);
    });

    card.append(toggleBtn, wrap);
    list.appendChild(card);
  }

  /* ─── Inline thread view w/ replies & form ─────────────── */
  async function renderThreadView(threadId, wrap) {
    const threadDoc = await getDoc(doc(db, "townhall_threads", threadId));
    if (!threadDoc.exists()) {
      wrap.innerHTML = "<p class='text-red-600'>Thread not found.</p>";
      return;
    }

    const t         = threadDoc.data();
    const replyList = document.createElement("section");
    replyList.id    = `reply-list-${threadId}`;
    replyList.className = "space-y-2 border-t pt-3";
    replyList.textContent = "Loading replies…";

    /* reply form ------------------------------------------------------- */
    const form = document.createElement("form");
    form.className = "space-y-2 border-t pt-3";
    form.innerHTML = `
      <input name="name" placeholder="Your name"
             class="border p-2 rounded w-full" required />
      <textarea name="content" placeholder="Your reply…"
                class="border p-2 rounded w-full" rows="3" required></textarea>
      <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Reply
      </button>
    `;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name    = form.name.value.trim();
      const content = form.content.value.trim();
      if (!name || !content) return;

      const user = auth.currentUser;
      if (!user) return alert("Please sign in first.");

      await addDoc(
        collection(db, "townhall_threads", threadId, "replies"),
        {
          displayName: name,
          content,
          uid: user.uid,
          timestamp: serverTimestamp()
        }
      );
      form.reset();
    });

    /* realtime replies listener --------------------------------------- */
    onSnapshot(
      query(collection(db, "townhall_threads", threadId, "replies"),
            orderBy("timestamp", "asc")),
      (snap) => {
        replyList.innerHTML = "";
        if (snap.empty) {
          replyList.textContent = "No replies yet.";
          return;
        }
        snap.forEach((d) => {
          const r   = d.data();
          const div = document.createElement("div");
          div.className = "border-l-2 pl-2";
          div.innerHTML = `
            <p class='font-medium'>${r.displayName || "Anon"}</p>
            <p>${r.content}</p>
            <p class='text-xs text-gray-500'>
              🕒 ${r.timestamp?.toDate().toLocaleString() ?? ""}
            </p>`;
          replyList.appendChild(div);
        });
      }
    );

    wrap.innerHTML = `<p class="whitespace-pre-line">${t.body}</p>`;
    wrap.append(replyList, form);
  }

  /* kickoff */
  loadMore();
});
