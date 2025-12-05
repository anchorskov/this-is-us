const API_BASE = (window.EVENTS_API_URL || "/api").replace(/\/$/, "");

const state = {
  topic_slug: "all",
  session: "",
  chamber: "",
  status: "",
};

const els = {
  root: document.getElementById("pending-bills-root"),
  topic: document.getElementById("pending-topic-filter"),
  session: document.getElementById("pending-session-filter"),
  chamber: document.getElementById("pending-chamber-filter"),
  status: document.getElementById("pending-status-filter"),
};

let topicOptions = [];

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildApiUrl(path) {
  return `${API_BASE}${path}`;
}

async function fetchTopics() {
  const res = await fetch(buildApiUrl("/hot-topics"));
  if (!res.ok) throw new Error(`Topic fetch failed (${res.status})`);
  const data = await res.json();
  topicOptions = Array.isArray(data) ? data : data.results || [];
  const sorted = [...topicOptions].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

  if (els.topic) {
    els.topic.innerHTML = `<option value="all">All topics</option>` + sorted
      .map(
        (t) =>
          `<option value="${escapeHtml(t.slug)}">${escapeHtml(t.title || t.slug)}</option>`
      )
      .join("");
  }
}

async function fetchBills() {
  const params = new URLSearchParams();
  if (state.topic_slug && state.topic_slug !== "all") params.set("topic_slug", state.topic_slug);
  if (state.session) params.set("session", state.session);
  if (state.chamber) params.set("chamber", state.chamber);
  if (state.status) params.set("status", state.status);

  const res = await fetch(
    `${buildApiUrl("/civic/pending-bills-with-topics")}?${params.toString()}`
  );
  if (!res.ok) throw new Error(`Bills fetch failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

function syncSessionOptions(bills) {
  if (!els.session) return;
  const current = els.session.value;
  const sessions = Array.from(
    new Set(bills.map((b) => b.legislative_session).filter(Boolean))
  ).sort((a, b) => String(b).localeCompare(String(a)));

  const options = [`<option value="">All sessions</option>`].concat(
    sessions.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
  );
  els.session.innerHTML = options.join("");
  if (sessions.includes(current)) {
    els.session.value = current;
  }
}

function renderBills(bills) {
  if (!els.root) return;
  if (!bills.length) {
    els.root.innerHTML = `<div class="empty-state">No bills matched those filters yet. Try a different topic or session.</div>`;
    return;
  }

  const cards = bills
    .map((bill) => {
      const subjects =
        Array.isArray(bill.subject_tags) && bill.subject_tags.length
          ? `<div class="tag-list">${bill.subject_tags
              .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
              .join("")}</div>`
          : "";

      const topics =
        Array.isArray(bill.topics) && bill.topics.length
          ? bill.topics
              .map((topic) => {
                const promptEncoded = encodeURIComponent(
                  topic.user_prompt_template || ""
                );
                const label = topic.label || topic.slug;
                const badgeLabel = topic.badge || label;
                const confidence =
                  typeof topic.confidence === "number"
                    ? topic.confidence.toFixed(2)
                    : null;

                return `
                  <div class="topic-block">
                    <div class="actions-row">
                      <span class="topic-badge">${escapeHtml(badgeLabel)}</span>
                      ${confidence ? `<span class="text-xs text-gray-500">confidence ${confidence}</span>` : ""}
                      <button class="copy-btn" data-prompt="${promptEncoded}">Copy prompt</button>
                    </div>
                    <div class="reason">${escapeHtml(label)}</div>
                    ${
                      topic.reason_summary
                        ? `<div class="text-gray-800 text-sm">${escapeHtml(topic.reason_summary)}</div>`
                        : ""
                    }
                    ${
                      topic.trigger_snippet
                        ? `<div class="snippet">“${escapeHtml(topic.trigger_snippet)}”</div>`
                        : ""
                    }
                  </div>
                `;
              })
              .join("")
          : `<div class="text-sm text-gray-500">No hot-topic matches yet.</div>`;

      return `
        <article class="bill-card">
          <div class="bill-header">
            <div class="bill-number">${escapeHtml(bill.bill_number || "Bill")}</div>
            <div class="bill-title">${escapeHtml(bill.title || "")}</div>
          </div>
          <div class="bill-meta">
            <span>${escapeHtml(bill.chamber || "Unknown chamber")}</span>
            <span>• ${escapeHtml(bill.status || "pending")}</span>
            <span>• Session ${escapeHtml(bill.legislative_session || "")}</span>
          </div>
          ${subjects}
          ${topics}
        </article>
      `;
    })
    .join("");

  els.root.innerHTML = cards;
}

async function refresh() {
  if (els.root) {
    els.root.innerHTML = `<div class="empty-state">Loading bills...</div>`;
  }
  try {
    const bills = await fetchBills();
    syncSessionOptions(bills);
    renderBills(bills);
  } catch (err) {
    console.error("Failed to load pending bills:", err);
    if (els.root) {
      els.root.innerHTML = `<div class="empty-state">Couldn't load bills. Please try again.</div>`;
    }
  }
}

function attachHandlers() {
  if (els.topic) {
    els.topic.addEventListener("change", (e) => {
      state.topic_slug = e.target.value;
      refresh();
    });
  }
  if (els.session) {
    els.session.addEventListener("change", (e) => {
      state.session = e.target.value;
      refresh();
    });
  }
  if (els.chamber) {
    els.chamber.addEventListener("change", (e) => {
      state.chamber = e.target.value;
      refresh();
    });
  }
  if (els.status) {
    els.status.addEventListener("change", (e) => {
      state.status = e.target.value;
      refresh();
    });
  }

  if (els.root) {
    els.root.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-prompt]");
      if (!button) return;
      const prompt = decodeURIComponent(button.dataset.prompt || "");
      try {
        await navigator.clipboard.writeText(prompt);
        const original = button.textContent;
        button.textContent = "Copied!";
        setTimeout(() => {
          button.textContent = original;
        }, 1200);
      } catch (err) {
        console.error("Clipboard write failed", err);
      }
    });
  }
}

async function init() {
  attachHandlers();
  try {
    await fetchTopics();
  } catch (err) {
    console.error("Failed to load topics", err);
  }
  refresh();
}

init();
