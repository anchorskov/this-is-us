// static/js/podcast-summary.js
(function () {
  const buttons = document.querySelectorAll(".podcast-summary-btn");
  if (!buttons.length) return;

  const getApiBase = async () => {
    // Wait a bit for EVENTS_API_READY to resolve (local Worker probe)
    if (window.EVENTS_API_READY) {
      try {
        const ready = await Promise.race([
          window.EVENTS_API_READY,
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1000))
        ]);
        if (ready && ready.length > 0) {
          console.log("📡 Using EVENTS_API_READY:", ready);
          return ready.replace(/\/$/, "");
        }
      } catch (err) {
        console.warn("⚠️  EVENTS_API_READY failed/timeout:", err.message);
      }
    }

    // Fallback to EVENTS_API_URL (set directly by site-scripts)
    let base = window.EVENTS_API_URL || "/api";
    
    // Ensure we have a valid base
    if (!base || base.trim() === "") {
      base = "/api";
    }
    
    // Ensure absolute URLs are used as-is, relative paths stay relative
    base = base.replace(/\/$/, "");
    console.log("📡 Using fallback API base:", base);
    return base;
  };

  const fetchSummary = async (guest, date, part) => {
    const params = new URLSearchParams({
      guest,
      date,
      part: String(part),
    });
    const apiBase = await getApiBase();
    const url = `${apiBase}/podcast/summary?${params.toString()}`;
    console.log("🔗 Fetching from:", url);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`status ${res.status}`);
    }
    return res.json();
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const guest = btn.getAttribute("data-guest");
      const date = btn.getAttribute("data-date");
      const part = btn.getAttribute("data-part");
      const targetId = btn.getAttribute("data-target");
      const panel = document.getElementById(targetId);
      if (!guest || !date || !part || !panel) return;

      const isOpen = panel.getAttribute("data-open") === "1";
      if (isOpen) {
        panel.hidden = true;
        panel.setAttribute("data-open", "0");
        btn.setAttribute("aria-expanded", "false");
        btn.textContent = "Show summary";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Loading summary...";
      panel.textContent = "Loading...";
      panel.hidden = false;
      try {
        const data = await fetchSummary(guest, date, part);
        const text = data.summary || data.reason || "Summary not available.";
        panel.textContent = text;
        panel.setAttribute("data-open", "1");
        btn.setAttribute("aria-expanded", "true");
        btn.textContent = "Hide summary";
      } catch (err) {
        panel.textContent = "Could not load summary.";
        panel.setAttribute("data-open", "1");
        btn.setAttribute("aria-expanded", "true");
        btn.textContent = "Hide summary";
        console.error("podcast summary fetch failed", err);
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
