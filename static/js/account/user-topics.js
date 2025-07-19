export async function initUserTopics() {
  const res  = await fetch("/api/user-topics");
  const list = await res.json();

  const wrap = document.getElementById("topics-container");
  wrap.innerHTML = "";

  list.forEach(t => {
    wrap.insertAdjacentHTML("beforeend", `
      <label class="flex gap-2 items-center py-1">
        <input type="checkbox" data-id="${t.id}" ${t.checked ? "checked" : ""}/>
        <span>${t.name}</span>
      </label>`);
  });

  wrap.querySelectorAll('input[type="checkbox"]').forEach(box =>
    box.addEventListener("change", () =>
      fetch("/api/user-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: Number(box.dataset.id),
          checked: box.checked
        })
      })));
}
