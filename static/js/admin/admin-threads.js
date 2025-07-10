// static/js/admin-threads.js
console.log("🧵 admin-threads.js loaded");

document.addEventListener("DOMContentLoaded", async () => {
  if (!firebase?.firestore) {
    console.error("❌ Firebase not initialized.");
    return;
  }

  const db = firebase.firestore();
  const tbody = document.getElementById("threads-tbody");
  const sortSelect = document.getElementById("sort-select");
  const threadCountDisplay = document.getElementById("thread-count");
  const loader = document.getElementById("loader");

  if (!tbody) return;

  const showLoader = () => {
    loader?.classList.remove("hidden");
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">Loading threads…</td></tr>`;
  };

  const hideLoader = () => {
    loader?.classList.add("hidden");
  };

  const fetchAndRenderThreads = async (sortKey = "createdAt", sortDirection = "desc") => {
    showLoader();

    try {
      let query = db.collection("townhall_posts");

      if (sortKey === "createdAt") {
        query = query.orderBy(sortKey, sortDirection).limit(50);
      } else {
        query = query.orderBy(sortKey).limit(50);
      }

      const snapshot = await query.get();
      tbody.innerHTML = "";
      hideLoader();

      if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">⚠️ No threads found.</td></tr>`;
        threadCountDisplay.textContent = "0 threads";
        return;
      }

      let count = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        const row = document.createElement("tr");

        row.innerHTML = `
          <td class="px-4 py-2 text-blue-700">${data.title || "Untitled"}</td>
          <td class="px-4 py-2">${data.authorName || "Anonymous"}</td>
          <td class="px-4 py-2">${data.city || "–"}</td>
          <td class="px-4 py-2">${data.state || "–"}</td>
          <td class="px-4 py-2">
            <button data-id="${doc.id}" class="delete-thread-btn text-red-600 hover:underline text-sm">Delete</button>
          </td>
        `;
        tbody.appendChild(row);
        count++;
      });

      threadCountDisplay.textContent = `${count} thread${count !== 1 ? 's' : ''}`;

      document.querySelectorAll(".delete-thread-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.dataset.id;
          if (confirm("Delete this thread? This cannot be undone.")) {
            try {
              await db.collection("townhall_posts").doc(id).delete();
              btn.closest("tr").remove();
              console.log(`🗑️ Deleted thread ${id}`);
              await fetchAndRenderThreads(sortKey, sortDirection);
            } catch (err) {
              console.error("❌ Failed to delete thread:", err);
              alert("Failed to delete thread.");
            }
          }
        });
      });

    } catch (err) {
      console.error("❌ Error loading threads:", err);
      tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Failed to load threads.</td></tr>`;
      hideLoader();
    }
  };

  // Initial fetch
  await fetchAndRenderThreads();

  // Sort handler
  sortSelect?.addEventListener("change", async () => {
    const value = sortSelect.value;
    switch (value) {
      case "title":
      case "authorName":
      case "city":
      case "state":
        await fetchAndRenderThreads(value, "asc");
        break;
      default:
        await fetchAndRenderThreads("createdAt", "desc");
        break;
    }
  });
});
