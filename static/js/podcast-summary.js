// static/js/podcast-summary.js
(function () {
  const buttons = document.querySelectorAll(".podcast-summary-btn");
  if (!buttons.length) return;

  let modal, modalTitle, modalBody;

  const ensureModal = () => {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "podcast-summary-modal hidden";
    modal.innerHTML = `
      <div class="podcast-summary-modal__backdrop"></div>
      <div class="podcast-summary-modal__dialog" role="dialog" aria-modal="true">
        <div class="podcast-summary-modal__header">
          <h3 class="podcast-summary-modal__title">Summary</h3>
          <button class="podcast-summary-modal__close" aria-label="Close summary">×</button>
        </div>
        <div class="podcast-summary-modal__body"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modalTitle = modal.querySelector(".podcast-summary-modal__title");
    modalBody = modal.querySelector(".podcast-summary-modal__body");

    const hide = () => modal.classList.add("hidden");
    modal.querySelector(".podcast-summary-modal__close").addEventListener("click", hide);
    modal.querySelector(".podcast-summary-modal__backdrop").addEventListener("click", hide);
    return modal;
  };

  const getApiBase = async () => {
    if (window.EVENTS_API_READY) {
      try {
        const ready = await window.EVENTS_API_READY;
        if (ready) return ready.replace(/\/$/, "");
      } catch (err) {
        console.warn("podcast summary: EVENTS_API_READY failed", err);
      }
    }
    const base = (window.EVENTS_API_URL || "/api").replace(/\/$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  };

  const fetchSummary = async (guest, date, part) => {
    const params = new URLSearchParams({ guest, date, part: String(part) });
    const apiBase = await getApiBase();
    const primaryUrl = `${apiBase}/podcast/summary?${params.toString()}`;
    
    // Try primary path first
    try {
      const res = await fetch(primaryUrl);
      if (res.status === 404) {
        // Try alternate path if primary returns 404
        console.log("podcast summary: primary 404, retrying alternate path");
        const altApiBase = apiBase.replace(/\/api$/, "");
        const alternateUrl = `${altApiBase}/podcast/summary?${params.toString()}`;
        const altRes = await fetch(alternateUrl);
        if (!altRes.ok) {
          return { summary: null, reason: "Summary not available." };
        }
        return altRes.json();
      }
      if (!res.ok) {
        return { summary: null, reason: `Summary request failed (${res.status})` };
      }
      return res.json();
    } catch (err) {
      console.error("podcast summary fetch error:", err);
      return { summary: null, reason: "Summary not available." };
    }
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const guest = btn.getAttribute("data-guest");
      const date = btn.getAttribute("data-date");
      const part = btn.getAttribute("data-part");
      if (!guest || !date || !part) return;

      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "Loading summary...";

      try {
        const data = await fetchSummary(guest, date, part);
        const text = data.summary || data.reason || "Summary not available.";
        ensureModal();
        modalTitle.textContent = `Summary`;
        modalBody.textContent = text;
        modal.classList.remove("hidden");
        btn.setAttribute("aria-expanded", "true");
      } catch (err) {
        ensureModal();
        modalTitle.textContent = "Summary";
        modalBody.textContent = "Could not load summary.";
        modal.classList.remove("hidden");
        btn.setAttribute("aria-expanded", "true");
        console.error("podcast summary fetch failed:", err);
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  });
})();
