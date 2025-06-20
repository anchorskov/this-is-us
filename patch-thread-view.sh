#!/bin/bash
# Apply UI and logic improvements to thread-view.js

TARGET="static/js/townhall/thread-view.js"
BACKUP="$TARGET.bak.$(date +%s)"

cp "$TARGET" "$BACKUP" && echo "📦 Backup saved to $BACKUP"

# Replace renderThreadHTML with version that includes a back button
sed -i '/function renderThreadHTML/,/^}/c\
function renderThreadHTML(t) {\n\
  const esc = str => String(str).replace(/[&<>\"'\"']/g, c =>\n\
    ({ \"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",\"\\\"\":\"&quot;\",\"'\":\"&#39;\" })[c]\n\
  );\n\
\n\
  return `\n\
    <div class="p-6 bg-white rounded shadow space-y-6">\n\
      <a href="/townhall/threads/" class="text-blue-600 underline text-sm">&larr; Back to all threads</a>\n\
      <header class="space-y-2">\n\
        <h1 class="text-2xl font-bold">${esc(t.title || "Untitled")}</h1>\n\
        <p class="text-gray-700 whitespace-pre-line">${esc(t.body || "")}</p>\n\
        <p class="text-sm text-gray-500">\n\
          📍 ${esc(t.location || "Unknown")} • 🕒 ${niceDate(t.timestamp)}\n\
        </p>\n\
      </header>\n\
      <section id="reply-list" class="space-y-4 border-t pt-4">\n\
        <p class="text-gray-500">Loading replies…</p>\n\
      </section>\n\
      <form id="reply-form" class="space-y-2 border-t pt-4">\n\
        <input name="name" placeholder="Your name" class="border p-2 rounded w-full" required />\n\
        <textarea name="content" placeholder="Your reply…" class="border p-2 rounded w-full" rows="3" required></textarea>\n\
        <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Reply</button>\n\
      </form>\n\
    </div>`;\n\
}' "$TARGET"

# Append editReply() and update renderReplies to show edit/delete controls
cat <<'EOF' >> "$TARGET"

function renderReplies(snap, list) {
  list.innerHTML = "";
  if (snap.empty) {
    list.innerHTML = `<p class="text-gray-400">No replies yet.</p>`;
    return;
  }

  const user = firebase.auth().currentUser;

  snap.forEach(doc => {
    const r = doc.data();
    const div = $$("div", "border-l-2 pl-3 space-y-1");

    const nameEl = document.createElement("p");
    nameEl.className = "font-medium";
    nameEl.textContent = r.displayName || "Anonymous";

    const contentEl = document.createElement("p");
    contentEl.textContent = r.content;

    const timeEl = document.createElement("p");
    timeEl.className = "text-xs text-gray-500";
    timeEl.textContent = `🕒 ${niceDate(r.timestamp)}`;

    div.append(nameEl, contentEl, timeEl);

    if (user && r.uid === user.uid) {
      const controls = $$("div", "text-xs space-x-2 text-right text-gray-500 mt-1");

      const editBtn = $$("button", "hover:underline text-blue-600");
      editBtn.textContent = "Edit";
      editBtn.onclick = () => editReply(doc.id, r.content, qs("#reply-form"), doc.ref);

      const deleteBtn = $$("button", "hover:underline text-red-600");
      deleteBtn.textContent = "Delete";
      deleteBtn.onclick = () => {
        if (confirm("Delete this reply?")) {
          doc.ref.delete().catch(err => alert("Delete failed."));
        }
      };

      controls.append(editBtn, deleteBtn);
      div.appendChild(controls);
    }

    list.appendChild(div);
  });
}

function editReply(id, content, form, ref) {
  form.content.value = content;
  form.name.disabled = true;
  form.dataset.editing = id;

  const btn = form.querySelector("button");
  btn.textContent = "Update";
  btn.classList.remove("bg-blue-600");
  btn.classList.add("bg-yellow-500");

  btn.onclick = async (e) => {
    e.preventDefault();
    const updated = form.content.value.trim();
    if (!updated) return alert("Reply content required.");

    await ref.update({ content: updated });
    form.reset();
    form.name.disabled = false;
    delete form.dataset.editing;
    btn.textContent = "Reply";
    btn.classList.remove("bg-yellow-500");
    btn.classList.add("bg-blue-600");
  };
}
EOF

echo "✅ thread-view.js has been patched."
