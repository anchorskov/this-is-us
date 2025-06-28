// static/js/testmap.js

import { findLatLon } from './findLatLon.js';

document.addEventListener("DOMContentLoaded", () => {
  const map = L.map("map").setView([43.0, -107.5], 6); // Default center: Wyoming
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  let marker;
  const coordBox = document.getElementById("coordsDisplay");

  // Reset form on window focus
  window.addEventListener("focus", () => {
    document.getElementById("addressForm").reset();
    document.getElementById("errorMsg").textContent = "";
    coordBox.textContent = "";
    if (marker) {
      map.removeLayer(marker);
      marker = null;
      console.log("🗑️ Marker removed on page focus");
    }
  });

  // Add Clear Form button dynamically
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "🧹 Clear Form";
  clearBtn.className = "ml-4 px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded";
  document.getElementById("addressForm").appendChild(clearBtn);

  clearBtn.addEventListener("click", () => {
    document.getElementById("addressForm").reset();
    document.getElementById("errorMsg").textContent = "";
    coordBox.textContent = "";
    if (marker) {
      map.removeLayer(marker);
      marker = null;
      console.log("🗑️ Marker removed on manual clear");
    }
    console.log("🧼 Form manually cleared");
  });

  // Handle form submission
  document.getElementById("addressForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const street = document.getElementById("street").value.trim();
    const city = document.getElementById("city").value.trim();
    const state = document.getElementById("state").value.trim();
    const zip = document.getElementById("zip").value.trim();
    const errorMsg = document.getElementById("errorMsg");

    errorMsg.textContent = "";
    console.clear();
    console.log("🔍 Form submitted");

    if (!street || !city || !state || !zip) {
      errorMsg.textContent = "❗ Please fill in all fields before searching.";
      console.warn("Missing input fields.");
      return;
    }

    const fullAddress = `${street}, ${city}, ${state} ${zip}`;
    console.log("📫 Full address submitted:", fullAddress);

    try {
      const { lat, lon, displayName, source } = await findLatLon(fullAddress);

      console.log(`✅ ${source} returned coordinates:`, lat, lon);

      if (isNaN(lat) || isNaN(lon)) {
        errorMsg.textContent = "⚠️ Invalid coordinates received. Please double-check the address.";
        return;
      }

      if (marker) map.removeLayer(marker);

      marker = L.marker([lat, lon], { draggable: true })
        .addTo(map)
        .bindPopup(`${displayName}<br/><em>You can move the pin to the exact location.</em>`)
        .openPopup();

      map.setView([lat, lon], 14);

      coordBox.innerHTML = `📍 Latitude: <strong>${lat.toFixed(6)}</strong>, Longitude: <strong>${lon.toFixed(6)}</strong>`;
      console.log("📌 Pin set at:", lat, lon);

      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        coordBox.innerHTML = `📍 Adjusted: <strong>${lat.toFixed(6)}</strong>, <strong>${lng.toFixed(6)}</strong>`;
        console.log("📍 Pin moved to:", lat, lng);
      });

    } catch (err) {
      errorMsg.textContent = "🚫 Unable to locate address. Please try again.";
      console.error("Geolocation error:", err.message);
    }
  });
});
