/* ---------------------------------------------------------
   static/js/townhall/threads.js
   Controller for /townhall/threads/ list page
   – Loads threads in pages of 15
   – Infinite scroll via IntersectionObserver
   – Client-side topic filter (debounced)
   – Zero external deps except Firebase + Tailwind
   --------------------------------------------------------- */

console.log("📂 townhall/threads.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("threads-container");
  if (!list) {
    console.warn("🔕 #threads-container missing");
    return;
  }

  if (typeof firebase === "undefined" || !firebase.firestore) {
    list.innerHTML =
      '<div class="col-span-full text-red-600">⚠️ Firebase not available.</div>';
    return;
  }

  const db = firebase.firestore();
  let lastSnap = null;   // pagination cursor
  let busy = false;
  const PAGE = 15;

  /* ── Render one thread doc into a card ───────────────────────── */
  function renderCard(doc) {
    const t  = doc.data();
    const ts = t.timestamp?.toDate()?.toLocaleString() ?? "🤷";
    const safeId = encodeURIComponent(doc.id);
    list.insertAdjacentHTML("beforeend", `
      <article class="bg-white rounded shadow p-4 flex flex-col space-y-2">
        <h3 class="font-semibold text-lg">${t.title ?? "Untitled"}</h3>
        <p class="line-clamp-3 text-sm">${t.body ?? ""}</p>
        <p class="text-xs text-gray-500 mt-auto">
          📍 ${t.location ?? "Unknown"} • 🕒 ${ts}
        </p>
        <a class="text-blue-600 hover:underline"
           href="/townhall/thread/?id=${safeId}">Open ↗</a>
      </article>
    `);
  }

  /* ── Fetch next page of threads ──────────────────────────────── */
  async function loadMore() {
    if (busy) return;
    busy = true;
    console.log("⏳ Loading next page…");

    let q = db.collection("townhall_threads")
              .orderBy("timestamp", "desc")
              .limit(PAGE);

    if (lastSnap) {
      q = q.startAfter(lastSnap);
    }

    try {
      const snap = await q.get();
      if (snap.empty) {
        console.log("✅ No more threads to load.");
        return;
      }

      snap.forEach(renderCard);
      lastSnap = snap.docs[snap.docs.length - 1];
      console.log(`✅ Loaded ${snap.docs.length} threads.`);
    } catch (err) {
      console.error("❌ Error fetching threads:", err);
    } finally {
      busy = false;
    }
  }

  /* ── Infinite scroll sentinel ───────────────────────────────── */
  const sentinel = document.getElementById("load-more");
  if (sentinel) {
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore();
    }).observe(sentinel);
  } else {
    console.warn("🔕 #load-more sentinel missing");
  }

  /* ── Topic filter (client-side, debounced) ───────────────────── */
  const filterInput = document.getElementById("topic-filter");
  if (filterInput) {
    let timer;
    filterInput.addEventListener("input", e => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const term = e.target.value.trim().toLowerCase();
        console.log("🔍 Filtering threads by:", term);
        document.querySelectorAll("#threads-container article").forEach(card => {
          const text = card.textContent.toLowerCase();
          card.classList.toggle("hidden", !text.includes(term));
        });
      }, 250);
    });
  }

  /* ── Kick off initial load ───────────────────────────────────── */
  loadMore();
});
