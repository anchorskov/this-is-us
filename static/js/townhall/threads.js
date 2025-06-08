/*  static/js/townhall/threads.js
    Controller for /townhall/threads/ list page                       */

console.log("📂 townhall/threads.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const list   = document.getElementById("threads-container");
  if (!list) return console.warn("🔕 threads-container missing");

  if (!firebase?.firestore) {
    list.innerHTML =
      '<div class="col-span-full text-red-600">⚠️ Firebase not available.</div>';
    return;
  }

  const db       = firebase.firestore();
  let   lastSnap = null;           // pagination cursor
  let   busy     = false;
  const PAGE     = 15;

  /* render one doc -> card */
  const renderCard = (doc) => {
    const t  = doc.data();
    const ts = t.timestamp?.toDate()?.toLocaleString() ?? "🤷";
    list.insertAdjacentHTML("beforeend", `
      <article class="bg-white rounded shadow p-4 flex flex-col space-y-2">
        <h3 class="font-semibold text-lg">${t.title ?? "Untitled"}</h3>
        <p class="line-clamp-3 text-sm">${t.body ?? ""}</p>
        <p class="text-xs text-gray-500 mt-auto">
          📍 ${t.location ?? "Unknown"} • 🕒 ${ts}
        </p>
        <a class="text-blue-600 hover:underline"
           href="/townhall/thread/?id=${doc.id}">Open ↗</a>
      </article>
    `);
  };

  /* load PAGE threads starting after last cursor */
  const loadMore = async () => {
    if (busy) return; busy = true;

    let q = db.collection("townhall_threads")
              .orderBy("timestamp", "desc")
              .limit(PAGE);

    if (lastSnap) q = q.startAfter(lastSnap);

    const snap = await q.get();
    if (snap.empty) return;        // nothing more

    snap.forEach(renderCard);
    lastSnap = snap.docs[snap.docs.length - 1];
    busy     = false;
  };

  /* infinite scroll using IntersectionObserver */
  const sentinel = document.getElementById("load-more");
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadMore();
  }).observe(sentinel);

  /* topic filter (client-side search) */
  const filterInput = document.getElementById("topic-filter");
  filterInput?.addEventListener("input", _.debounce((e) => {
    const term = e.target.value.trim().toLowerCase();
    document.querySelectorAll("#threads-container article").forEach(card => {
      const match = card.textContent.toLowerCase().includes(term);
      card.classList.toggle("hidden", !match);
    });
  }, 250));

  /* initial fetch */
  loadMore();
});
