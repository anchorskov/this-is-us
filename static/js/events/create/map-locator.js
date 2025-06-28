// 📍 ZIP-first map locator helper (no auto-run)

import { findLatLon } from "/js/findLatLon.js";

export function setupMapLocator({
  mapId    = "map",
  formId   = "addressForm",
  errorId  = "errorMsg",
  resultId = "latlonDisplay",
} = {}) {

  /* 0️⃣ sanity checks */
  if (!window.L) { console.error("❌ Leaflet not loaded"); return; }
  const mapEl  = document.getElementById(mapId);
  const formEl = document.getElementById(formId);
  if (!mapEl || !formEl) { console.warn("🛑 Map or form missing"); return; }

  /* 1️⃣ build map (prevent dupes) */
  if (mapEl._leaflet_id) return;           // already built
  const map = L.map(mapId).setView([43,-107.5], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(map);

  let marker = null;

  /* 2️⃣ clear helpers */
  function resetOutputs() {
    document.getElementById(errorId).textContent  = "";
    document.getElementById(resultId).textContent = "";
  }

  /* 3️⃣ clear-form button */
  const clearBtn = document.createElement("button");
  clearBtn.type      = "button";
  clearBtn.textContent = "🧹 Clear";
  clearBtn.className   = "ml-4 px-3 py-1 bg-gray-300 rounded";
  formEl.appendChild(clearBtn);

  clearBtn.addEventListener("click", () => {
    formEl.reset(); resetOutputs();
    if (marker) { map.removeLayer(marker); marker = null; }
  });

  /* 4️⃣ address submit */
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault(); resetOutputs();

    const street = formEl.querySelector("#street")?.value.trim();
    const city   = formEl.querySelector("#city")?.value.trim();
    const state  = formEl.querySelector("#state")?.value.trim();
    const zip    = formEl.querySelector("#zip")?.value.trim();
    if (![street, city, state, zip].every(Boolean)) {
      document.getElementById(errorId).textContent = "Fill all fields";
      return;
    }

    try {
      const { lat, lon, displayName } =
        await findLatLon(`${street}, ${city}, ${state} ${zip}`);

      /* drop / move marker */
      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lon], { draggable: true })
        .addTo(map).bindPopup(displayName).openPopup();
      map.setView([lat, lon], 14);

      /* show coords + stash in hidden fields */
      document.getElementById(resultId).textContent =
        `📌 ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      document.getElementById("lat").value = lat;
      document.getElementById("lng").value = lon;

      /* broadcast success */
      document.dispatchEvent(
        new CustomEvent("locationSet", { detail: { lat, lon, displayName } })
      );

    } catch (err) {
      document.getElementById(errorId).textContent = "Lookup failed";
      console.error(err);
    }
  });
}
