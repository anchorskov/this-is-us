// static/js/civic/pending-bills.js
console.log("📜 pending-bills.js loaded - starting initialization");

const state = {
  topic_slug: "all",
  session: "",
  chamber: "",
  status: "",
  reviewFilter: "reviewed", // reviewed | all
};

const els = {
  root: document.getElementById("pending-bills-root"),
  topic: document.getElementById("pending-topic-filter"),
  session: document.getElementById("pending-session-filter"),
  chamber: document.getElementById("pending-chamber-filter"),
  status: document.getElementById("pending-status-filter"),
  filterReviewed: document.getElementById("pending-filter-reviewed"),
  filterAll: document.getElementById("pending-filter-all"),
};

let topicOptions = [];
let allBills = [];

function updateFilterButtons() {
  if (els.filterReviewed && els.filterAll) {
    if (state.reviewFilter === "reviewed") {
      els.filterReviewed.classList.add("verify-filter-btn--active");
      els.filterAll.classList.remove("verify-filter-btn--active");
    } else {
      els.filterAll.classList.add("verify-filter-btn--active");
      els.filterReviewed.classList.remove("verify-filter-btn--active");
    }
  }
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSponsorLine(sponsors = []) {
  if (!Array.isArray(sponsors) || sponsors.length === 0) return "";
  const names = sponsors
    .slice(0, 2)
    .map((s) => s?.name || "")
    .filter(Boolean);
  if (!names.length) return "";
  return `Sponsored by ${names.join(", ")}`;
}

function buildSponsorBlock(bill = {}) {
  const line = buildSponsorLine(bill.sponsors);
  if (line) {
    const first = bill.sponsors?.[0] || {};
    const contact = first.contact_website
      ? `<a class="cw-link" href="${escapeHtml(first.contact_website)}" target="_blank" rel="noopener">Contact sponsor</a>`
      : first.contact_email
      ? `<a class="cw-link" href="mailto:${escapeHtml(first.contact_email)}">Contact sponsor</a>`
      : "";
    return `<div class="meta text-sm text-gray-700">${escapeHtml(line)} ${contact}</div>`;
  }
  return `<div class="meta text-sm text-gray-500">Sponsor info not available yet.</div>`;
}

function buildVerificationBadge(bill = {}) {
  const status = bill.verification_status;
  if (!status || status === "missing") return "";
  const isOk = status === "ok" && bill.structural_ok !== false;
  const reason = bill.status_reason || bill.structural_reason || "";
  const conf =
    typeof bill.verification_confidence === "number"
      ? bill.verification_confidence
      : null;
  const baseTitle = isOk
    ? "Verified (LSO + AI): structural checks passed."
    : `Needs review: ${reason || "structural or data gap"}`;
  const confText = conf ? ` Confidence: ${(conf * 100).toFixed(0)}%.` : "";
  const label = isOk ? "Verified (LSO + AI)" : "Needs review";
  const cls = isOk ? "verify-ok" : "verify-flagged";
  return `<span class="verification-badge ${cls}" title="${escapeHtml(
    baseTitle + confText
  )}">${escapeHtml(label)}</span>`;
}

function isReviewed(bill = {}) {
  const hasSummary = Boolean(bill.ai_plain_summary && bill.ai_plain_summary.trim().length);
  return bill.verification_status === "ok" && bill.structural_ok && hasSummary;
}

function isUnderReview(bill = {}) {
  const hasSummary = Boolean(bill.ai_plain_summary && bill.ai_plain_summary.trim().length);
  if (bill.verification_status === "flagged") return true;
  if (!bill.verification_status && !hasSummary) return true;
  if (bill.verification_status === "ok" && !hasSummary) return true;
  if (bill.structural_ok === false) return true;
  return false;
}

async function getApiBase() {
  if (window.EVENTS_API_READY) {
    try {
      const ready = await window.EVENTS_API_READY;
      if (ready) return ready.replace(/\/$/, "");
    } catch (err) {
      console.warn("EVENTS_API_READY failed; falling back to EVENTS_API_URL", err);
    }
  }
  const base = window.EVENTS_API_URL || "/api";
  return base.replace(/\/$/, "");
}

async function fetchTopics() {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/hot-topics`);
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
  const apiBase = await getApiBase();
  const params = new URLSearchParams();
  if (state.topic_slug && state.topic_slug !== "all") params.set("topic_slug", state.topic_slug);
  if (state.session) params.set("session", state.session);
  if (state.chamber) params.set("chamber", state.chamber);
  if (state.status) params.set("status", state.status);
  if (state.reviewFilter === "all") params.set("include_flagged", "true");

  const url = `${apiBase}/civic/pending-bills-with-topics?${params.toString()}`;
  console.log("🔍 Fetching bills from:", url, "with filters:", state);
  
  const res = await fetch(url);
  console.log("📡 Fetch response status:", res.status, "ok:", res.ok);
  
  if (!res.ok) {
    const errText = await res.text();
    console.error("❌ Bills fetch error response:", errText);
    throw new Error(`Bills fetch failed (${res.status}): ${errText}`);
  }
  
  let data;
  try {
    const rawText = await res.text();
    console.log("📦 Raw response:", rawText.substring(0, 500));
    data = JSON.parse(rawText);
  } catch (parseErr) {
    console.error("❌ JSON parse error:", parseErr, "raw response was:", data);
    throw new Error(`Failed to parse bills response: ${parseErr.message}`);
  }
  
  console.log("✅ Parsed data:", data);
  const bills = Array.isArray(data) ? data : data.results || [];
  console.log("📋 Bills array:", bills.length, "items");
  
  if (bills.length > 0) {
    console.log("🔍 First bill structure:", JSON.stringify(bills[0], null, 2));
  }
  
  return bills;
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
  if (!els.root) {
    console.warn("⚠️ No root element found for bills list");
    return;
  }
  const visible =
    state.reviewFilter === "reviewed" ? bills.filter(isReviewed) : bills.slice();

  if (!visible.length) {
    const hasAny = bills.length > 0;
    const message = hasAny
      ? `We are still verifying bill summaries. You can include bills under review to see more.`
      : `No bills matched those filters yet. Try a different topic or session.`;
    els.root.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
    return;
  }
  console.log(`✨ Rendering ${visible.length} bill cards (filter: ${state.reviewFilter})`);


  const cards = visible
    .map((bill) => {
      const subjects =
        Array.isArray(bill.subject_tags) && bill.subject_tags.length
          ? `<div class="tag-list">${bill.subject_tags
              .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
              .join("")}</div>`
          : "";

      const reviewed = isReviewed(bill);
      const underReview = isUnderReview(bill);

      const officialLink = bill.text_url || bill.external_url || "#";
      const pdfLink = bill.text_url;
      const lsoLink = bill.external_url;
      const headline =
        bill.short_title && bill.short_title !== "Unavailable"
          ? `${bill.bill_number || "Bill"} — ${bill.short_title}`
          : bill.bill_number || "Bill";

      const hasSummary = Boolean(bill.ai_plain_summary && bill.ai_plain_summary.trim().length);
      const summary = hasSummary
        ? `<div class="summary-block">
             <div class="summary-label">Plain summary <span class="ai-pill">AI</span></div>
             <div class="summary-text">${escapeHtml(bill.ai_plain_summary)}</div>
             ${
               bill.ai_summary_notice
                 ? `<div class="summary-notice text-xs text-gray-600 mt-1">${escapeHtml(
                     bill.ai_summary_notice
                   )}</div>`
                 : ""
             }
           </div>`
        : `<div class="summary-block">
             <div class="summary-label">Summary unavailable</div>
             <div class="summary-text text-sm text-gray-700">
               Summary unavailable. View the full bill text on the official site.
               ${
                 officialLink && officialLink !== "#"
                   ? `<a class="cw-link" href="${escapeHtml(officialLink)}" target="_blank" rel="noopener">Open official bill</a>`
                   : ""
               }
             </div>
           </div>`;
      const linksBlock =
        lsoLink || pdfLink
          ? `<div class="bill-links">
              ${
                lsoLink
                  ? `<a class="cw-link" href="${escapeHtml(
                      lsoLink
                    )}" target="_blank" rel="noopener">View bill on wyoleg.gov</a>`
                  : ""
              }
              ${
                pdfLink
                  ? `<a class="cw-link" href="${escapeHtml(
                      pdfLink
                    )}" target="_blank" rel="noopener">Download bill PDF</a>`
                  : ""
              }
            </div>`
          : "";

      const keyPoints =
        reviewed && Array.isArray(bill.ai_key_points) && bill.ai_key_points.length
          ? `<ul class="keypoints">
               ${bill.ai_key_points
                 .map((point) => `<li>${escapeHtml(point)}</li>`)
                 .join("")}
             </ul>`
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
                      <button
                        class="copy-btn"
                        title="For additional info on this bill, copy an AI prompt you can paste into your AI tool of choice."
                        data-prompt="${promptEncoded}"
                      >
                        Copy AI Prompt
                      </button>
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
            <div class="bill-number">${escapeHtml(headline)}</div>
            <div class="bill-title">${escapeHtml(bill.title || "")}</div>
          </div>
          <div class="bill-meta">
            <span>${escapeHtml(bill.chamber || "Unknown chamber")}</span>
            <span>• ${escapeHtml(bill.status || "pending")}</span>
            <span>• Session ${escapeHtml(bill.legislative_session || "")}</span>
            ${buildVerificationBadge(bill)}
          </div>
          ${buildSponsorBlock(bill)}
          ${linksBlock}
          <div class="vote-actions" data-bill-id="${escapeHtml(bill.id || "")}">
            <div class="vote-button-group">
              <button class="vote-button" data-direction="up" title="Support" data-hint="Support">
                👍 <span class="vote-count">${bill.up_votes ?? 0}</span>
              </button>
              <button class="vote-button" data-direction="down" title="Against" data-hint="Against">
                👎 <span class="vote-count">${bill.down_votes ?? 0}</span>
              </button>
              <button class="vote-button" data-direction="info" title="Need more info" data-hint="Need more info">
                ❓ <span class="vote-count">${bill.info_votes ?? 0}</span>
              </button>
            </div>
            <span class="vote-message text-xs text-gray-500"></span>
          </div>
          ${summary}
          ${keyPoints}
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
    console.log("🔄 Starting refresh...");
    const bills = await fetchBills();
    allBills = bills;
    console.log(`📊 Loaded ${bills.length} bills, syncing session options...`);
    syncSessionOptions(bills);
    console.log(`🎨 Rendering ${bills.length} bills...`);
    renderBills(allBills);
    console.log("✅ Render complete");
  } catch (err) {
    console.error("❌ Failed to load pending bills:", err);
    if (els.root) {
      els.root.innerHTML = `<div class="empty-state">
        <strong>Error loading bills:</strong><br/>
        ${escapeHtml(err.message)}<br/>
        <small>Check browser console for details.</small>
      </div>`;
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
  if (els.filterReviewed) {
    els.filterReviewed.addEventListener("click", () => {
      state.reviewFilter = "reviewed";
      updateFilterButtons();
      renderBills(allBills);
    });
  }
  if (els.filterAll) {
    els.filterAll.addEventListener("click", () => {
      state.reviewFilter = "all";
      updateFilterButtons();
      renderBills(allBills);
    });
  }

  if (els.root) {
    els.root.addEventListener("click", async (event) => {
      const promptBtn = event.target.closest("[data-prompt]");
      if (promptBtn) {
        const prompt = decodeURIComponent(promptBtn.dataset.prompt || "");
        try {
          await navigator.clipboard.writeText(prompt);
          const original = promptBtn.textContent;
          promptBtn.textContent = "Copied!";
          setTimeout(() => {
            promptBtn.textContent = original;
          }, 1200);
        } catch (err) {
          console.error("Clipboard write failed", err);
        }
        return;
      }

      const voteBtn = event.target.closest(".vote-button");
      if (voteBtn) {
        const actions = voteBtn.closest(".vote-actions");
        const billId = actions?.dataset?.billId;
        const direction = voteBtn.dataset?.direction;
        if (!billId || !direction) return;

        const user = window.currentUser || null;
        const msgEl = actions.querySelector(".vote-message");
        if (!user?.uid) {
          if (msgEl) msgEl.textContent = "Sign in to vote.";
          return;
        }

        const buttons = actions.querySelectorAll(".vote-button");
        buttons.forEach((b) => (b.disabled = true));

        try {
          const apiBase = await getApiBase();
          const res = await fetch(`${apiBase}/civic/items/${billId}/vote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vote: direction, user_id: user.uid }),
          });
          const data = await res.json();
          if (res.ok && data) {
            const upEl = actions.querySelector('[data-direction="up"] .vote-count');
            const downEl = actions.querySelector('[data-direction="down"] .vote-count');
            const infoEl = actions.querySelector('[data-direction="info"] .vote-count');
            if (upEl && typeof data.up_votes !== "undefined") upEl.textContent = data.up_votes;
            if (downEl && typeof data.down_votes !== "undefined") downEl.textContent = data.down_votes;
            if (infoEl && typeof data.info_votes !== "undefined") infoEl.textContent = data.info_votes;
            if (msgEl) msgEl.textContent = "Thanks for your feedback!";
          } else {
            if (msgEl) msgEl.textContent = data?.error || "Vote failed";
          }
        } catch (err) {
          console.error("Vote failed", err);
          if (msgEl) msgEl.textContent = "Vote failed";
        } finally {
          buttons.forEach((b) => (b.disabled = false));
        }
      }
    });
  }
}

async function init() {
  attachHandlers();
  updateFilterButtons();
  try {
    console.log("📌 Init: fetching topics...");
    await fetchTopics();
    console.log("📌 Init: topics fetched, calling refresh...");
  } catch (err) {
    console.error("Failed to load topics", err);
  }
  await refresh();
  console.log("📌 Init complete");
}

console.log("📌 About to call init()...");
init().catch(err => console.error("Init failed:", err));
console.log("📌 Init() called");

export { buildSponsorLine, buildSponsorBlock };
