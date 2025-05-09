// static/js/events/event-map.js
import { createZipSearchBox } from "../leafletzipsearch.js";

export function initMap() {
  const map = L.map("map").setView([39.5, -98.35], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

  const markerGroup = L.layerGroup().addTo(map);
  window._leafletMap = map;
  window._markerGroup = markerGroup;

  function setMarker(lat, lng) {
    document.querySelector("#lat").value = lat;
    document.querySelector("#lng").value = lng;
    markerGroup.clearLayers();
    L.marker([lat, lng]).addTo(markerGroup);
    map.setView([lat, lng], 14);
    document.querySelector("#locationConfirmation").textContent = `📍 Location set: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  map.on("click", (e) => setMarker(e.latlng.lat, e.latlng.lng));

  createZipSearchBox(map, setMarker);

  return { map, setMarker };
}

export function bindAddressSearch(setMarker) {
  const searchBtn = document.querySelector("#searchAddress");
  const addressInput = document.querySelector("#address");

  if (!searchBtn || !addressInput) return;

  searchBtn.addEventListener("click", async () => {
    const address = addressInput.value.trim();
    if (!address) return alert("Please enter an address.");

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          address
        )}`
      );
      const data = await res.json();
      if (!data.length) return alert("Location not found.");

      const { lat, lon } = data[0];
      setMarker(parseFloat(lat), parseFloat(lon));
    } catch (err) {
      console.error("Address lookup failed:", err);
      alert("Location lookup failed: " + err.message);
    }
  });
}
