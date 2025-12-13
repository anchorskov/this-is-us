// static/js/civic/watch.js

function $(id) {
  return document.getElementById(id);
}

async function getApiBase() {
  if (window.EVENTS_API_READY) {
    try {
      const ready = await window.EVENTS_API_READY;
      if (ready) return ready.replace(/\/$/, "");
    } catch (err) {
      console.warn("EVENTS_API_READY failed, falling back", err);
    }
  }
  const base = window.EVENTS_API_URL || "/api";
  return base.replace(/\/$/, "");
}

function renderHotTopics(container, topics = []) {
  if (!container) return;
  if (!topics.length) {
    container.innerHTML = `<div class="meta">No topics available.</div>`;
    return;
  }
  const items = topics
    .slice(0, 3)
    .map(
      (t) => `<li>
        <div class="flex justify-between items-center">
          <span class="font-semibold">${t.title || t.slug}</span>
          <span class="meta">${(t.civic_items || []).length || 0} bills</span>
        </div>
        <div class="meta">${t.summary || ""}</div>
      </li>`
    )
    .join("");
  container.innerHTML = `<ul>${items}</ul>`;
}

function renderPending(container, bills = []) {
  if (!container) return;
  if (!bills.length) {
    container.innerHTML = `<div class="meta">No pending bills found.</div>`;
    return;
  }
  const items = bills
    .slice(0, 3)
    .map(
      (b) => `<li>
        <div class="font-semibold">${b.bill_number || "Bill"}</div>
        <div class="meta">${b.title || ""}</div>
        <div class="meta">${b.status || ""} • Session ${b.legislative_session || ""}</div>
      </li>`
    )
    .join("");
  container.innerHTML = `<ul>${items}</ul>`;
}

function renderTownhall(container, posts = []) {
  if (!container) return;
  if (!posts.length) {
    container.innerHTML = `<div class="meta">No town threads yet. Check back soon.</div>`;
    return;
  }
  const items = posts
    .slice(0, 3)
    .map(
      (p) => `<li>
        <div class="font-semibold">${p.title || "Thread"}</div>
        <div class="meta">${p.city || p.state || "Wyoming"} • ${p.created_at || ""}</div>
      </li>`
    )
    .join("");
  container.innerHTML = `<ul>${items}</ul>`;
}

async function loadCivicWatch() {
  const apiBase = await getApiBase();
  const hotEl = $("cw-hot-topics-preview");
  const billsEl = $("cw-pending-preview");
  const townhallEl = $("cw-townhall-preview");

  try {
    const [topicsRes, billsRes, postsRes] = await Promise.all([
      fetch(`${apiBase}/hot-topics`),
      fetch(`${apiBase}/civic/pending-bills-with-topics`),
      fetch(`${apiBase}/townhall/posts?limit=3`),
    ]);

    if (!topicsRes.ok) throw new Error("Topics failed");
    if (!billsRes.ok) throw new Error("Bills failed");
    if (!postsRes.ok) throw new Error("Townhall failed");

    const topicsData = await topicsRes.json();
    const billsData = await billsRes.json();
    const postsData = await postsRes.json();

    const topics = Array.isArray(topicsData) ? topicsData : topicsData.results || [];
    const bills = Array.isArray(billsData) ? billsData : billsData.results || [];
    const posts = Array.isArray(postsData) ? postsData : postsData.results || postsData;

    renderHotTopics(hotEl, topics);
    renderPending(billsEl, bills);
    renderTownhall(townhallEl, posts);
  } catch (err) {
    console.error("Civic Watch load error", err);
    if (hotEl) hotEl.innerHTML = `<div class="meta text-red-600">Error loading topics.</div>`;
    if (billsEl) billsEl.innerHTML = `<div class="meta text-red-600">Error loading bills.</div>`;
    if (townhallEl) townhallEl.innerHTML = `<div class="meta text-red-600">Error loading town halls.</div>`;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadCivicWatch);
} else {
  loadCivicWatch();
}

export { renderHotTopics, renderPending, renderTownhall, loadCivicWatch };
