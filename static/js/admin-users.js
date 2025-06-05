// static/js/admin-users.js
console.log("🛠️ admin-users.js loaded");

document.addEventListener("DOMContentLoaded", async () => {
  if (!firebase?.firestore || !firebase?.auth) {
    console.error("❌ Firebase not ready in admin-users.js");
    return;
  }

  const auth = firebase.auth();
  const db = firebase.firestore();
  const tbody = document.getElementById("users-tbody");
  const searchInput = document.getElementById("user-search");

  auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    try {
      const currentUserRef = db.collection("users").doc(user.uid);
      const currentUserDoc = await currentUserRef.get();
      const currentUserData = currentUserDoc.data();

      if (!currentUserDoc.exists || currentUserData.role !== "admin") {
        alert("🔐 Access denied: Admins only.");
        window.location.href = "/account/";
        return;
      }

      const snapshot = await db.collection("users").get();
      let usersData = [];

      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });

      function renderTable(data) {
        tbody.innerHTML = "";

        if (!data.length) {
          tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">No users found.</td></tr>`;
          return;
        }

        data.forEach(userData => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td class="px-4 py-2 text-sm">${userData.displayName || "Anonymous"}</td>
            <td class="px-4 py-2 text-sm">${userData.email || "N/A"}</td>
            <td class="px-4 py-2 text-sm">${userData.city || ""}</td>
            <td class="px-4 py-2 text-sm">${userData.state || ""}</td>
            <td class="px-4 py-2 text-sm">${userData.role || "citizen"}</td>
            <td class="px-4 py-2 text-sm">
              <button data-id="${userData.id}" data-role="${userData.role}" class="text-blue-600 hover:underline promote-btn">
                ${userData.role === "admin" ? "Demote" : "Promote"}
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        });

        document.querySelectorAll(".promote-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const userId = btn.getAttribute("data-id");
            const currentRole = btn.getAttribute("data-role");
            const newRole = currentRole === "admin" ? "citizen" : "admin";

            if (!confirm(`Change role to ${newRole}?`)) return;

            try {
              await db.collection("users").doc(userId).update({ role: newRole });
              location.reload();
            } catch (err) {
              console.error("❌ Role update error:", err);
              alert("Failed to update role.");
            }
          });
        });
      }

      // Initial render
      renderTable(usersData);

      // Search filter
      searchInput.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = usersData.filter(u =>
          (u.displayName || "").toLowerCase().includes(term) ||
          (u.city || "").toLowerCase().includes(term) ||
          (u.state || "").toLowerCase().includes(term)
        );
        renderTable(filtered);
      });

    } catch (err) {
      console.error("❌ Failed to load users:", err);
      tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-600">Failed to load users.</td></tr>`;
    }
  });
});
