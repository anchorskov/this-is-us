import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

const auth = getAuth();

onAuthStateChanged(auth, async (user) => {
  if (!user || !user.emailVerified) return alert("Must be verified.");

  const token = await user.getIdToken();
  const res = await fetch("/api/topic-requests", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();

  if (res.status !== 200) return alert("Access denied.");

  const table = document.getElementById("requests-table");
  table.innerHTML = "";

  if (!data.length) {
    table.innerHTML = "<p>No pending requests.</p>";
    return;
  }

  data.forEach(row => {
    const div = document.createElement("div");
    div.className = "border p-4 mb-2";
    div.innerHTML = `
      <p><strong>${row.proposed_name}</strong> (from ${row.user_email})</p>
      <button data-action="approve" data-id="${row.id}" class="btn btn-green mr-2">Approve</button>
      <button data-action="reject" data-id="${row.id}" class="btn btn-red">Reject</button>
    `;
    table.appendChild(div);
  });

  table.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    const confirmMsg = action === "approve" ? "Approve this topic?" : "Reject this topic?";
    if (!confirm(confirmMsg)) return;

    const update = await fetch("/api/topic-requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id, action })
    });

    if (update.ok) {
      btn.closest("div").remove();
    } else {
      alert("Action failed.");
    }
  });
});
