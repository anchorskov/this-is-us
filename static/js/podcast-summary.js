// static/js/podcast-summary.js
(function () {
  const buttons = document.querySelectorAll(".podcast-summary-btn");
  if (!buttons.length) return;

  // In dev: try API on current origin first, then fallback to port 8787
  const getApiUrl = () => {
    const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    return isDev ? `http://${window.location.hostname}:8787` : window.location.origin;
  };

  const fetchSummary = async (guest, date, part) => {
    const params = new URLSearchParams({
      guest,
      date,
      part: String(part),
    });
    const apiBase = getApiUrl();
    const res = await fetch(`${apiBase}/api/podcast/summary?${params.toString()}`);
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
