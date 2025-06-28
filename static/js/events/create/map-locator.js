// static/js/events/create/map-locator.js
// 📍 Modular ZIP-first map locator with draggable pin + clear/reset

import { findLatLon } from '/js/findLatLon.js';

export function setupMapLocator({
  mapId = "map",
  formId = "addressForm",
  errorId = "errorMsg",
  resultId = "latlonDisplay"
} = {}) {
  const mapContainer = document.getElementById(mapId);
  const form = document.getElementById(formId);
  const errorMsg = document.getElementById(errorId);
  const resultOutput = document.getElementById(resultId);

  if (!mapContainer || !form) {
    console.warn("🛑 Required elements not found. Map setup aborted.");
    return;
  }

  const map = L.map(mapId).setView([43.0, -107.5], 6); // Wyoming default
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  let marker = null;

  // 🔄 Form Reset on Window Focus
  window.addEventListener("focus", () => {
    form.reset();
    if (marker) map.removeLayer(marker);
    if (errorMsg) errorMsg.textContent = "";
    if (resultOutput) resultOutput.textContent = "";
    console.log("🔄 Form reset on focus");
  });

  // 🧹 Clear Button
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "🧹 Clear Form";
  clearBtn.className = "ml-4 px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded";
  form.appendChild(clearBtn);

  clearBtn.addEventListener("click", () => {
    form.reset();
    if (marker) {
      map.removeLayer(marker);
      marker = null;
    }
    if (errorMsg) errorMsg.textContent = "";
    if (resultOutput) resultOutput.textContent = "";
    console.log("🧼 Cleared manually");
  });

  // 🔍 Handle Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const street = form.querySelector("#street")?.value.trim();
    const city = form.querySelector("#city")?.value.trim();
    const state = form.querySelector("#state")?.value.trim();
    const zip = form.querySelector("#zip")?.value.trim();

    if (errorMsg) errorMsg.textContent = "";
    if (resultOutput) resultOutput.textContent = "";
    console.clear();
    console.log("📨 Submitting form...");

    if (!street || !city || !state || !zip) {
      if (errorMsg) errorMsg.textContent = "❗ Please fill in all fields before searching.";
      console.warn("⚠️ Missing one or more address fields.");
      return;
    }

    const fullAddress = `${street}, ${city}, ${state} ${zip}`;
    console.log("📬 Address:", fullAddress);

    try {
      const { lat, lon, displayName, source } = await findLatLon(fullAddress);

      if (isNaN(lat) || isNaN(lon)) {
        if (errorMsg) errorMsg.textContent = "⚠️ Invalid coordinates received. Check address.";
        return;
      }

      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lon], { draggable: true })
        .addTo(map)
        .bindPopup(`${displayName}<br/><em>Adjust pin location if needed.</em>`)
        .openPopup();

      map.setView([lat, lon], 14);
      if (resultOutput) resultOutput.textContent = `📌 ${lat.toFixed(5)}, ${lon.toFixed(5)} (${source})`;
      console.log("✅ Coordinates set:", lat, lon);

      // Dispatch locationSet event for downstream UI logic (e.g., enabling OK button)
      document.dispatchEvent(new CustomEvent("locationSet", {
        detail: { lat, lon, displayName }
      }));

    } catch (err) {
      if (errorMsg) errorMsg.textContent = "🚫 Address lookup failed.";
      console.error("Geolocation error:", err.message);
    }
  });
}
