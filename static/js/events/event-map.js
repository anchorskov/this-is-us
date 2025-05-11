// static/js/events/event-map.js

// ——————————————————————————————————————————
// Simple selector
// ——————————————————————————————————————————
function $(selector) {
  return document.querySelector(selector);
}

// ——————————————————————————————————————————
// Defaults
// ——————————————————————————————————————————
const DEFAULT_VIEW = [39.5, -98.35];
const DEFAULT_ZOOM = 4;
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * Initialize the Leaflet map and return both map instance and marker‐setter.
 * @param {string} [mapSelector="#map"]
 * @param {[number,number]} [view=DEFAULT_VIEW]
 * @param {number} [zoom=DEFAULT_ZOOM]
 * @returns {{ map: L.Map, setMarker: (lat:number, lng:number)=>void }}
 */
export function initMap(
  mapSelector = "#map",
  view = DEFAULT_VIEW,
  zoom = DEFAULT_ZOOM
) {
  const el = $(mapSelector);
  if (!el) throw new Error(`Map container ${mapSelector} not found`);

  // initialize and ensure proper sizing
  const id = mapSelector.startsWith("#") ? mapSelector.slice(1) : mapSelector;
  const map = L.map(id).setView(view, zoom);
  setTimeout(() => map.invalidateSize(), 0);

  L.tileLayer(TILE_URL).addTo(map);
  const markerGroup = L.layerGroup().addTo(map);

  /**
   * Place a marker and populate hidden lat/lng inputs.
   */
  function setMarker(lat, lng) {
    const latInput = $("#lat");
    const lngInput = $("#lng");
    if (latInput) latInput.value = lat;
    if (lngInput) lngInput.value = lng;
    markerGroup.clearLayers();
    L.marker([lat, lng]).addTo(markerGroup);
    // notify form logic that location is set
    document.dispatchEvent(new Event("locationSet"));
  }

  // allow user to click map for location
  map.on("click", (e) => {
    setMarker(e.latlng.lat, e.latlng.lng);
  });

  return { map, setMarker };
}

/**
 * Bind an address search box to your map’s marker setter.
 * Uses Nominatim by default; swap in your createZipSearchBox if desired.
 * @param {function(number,number)} setMarker
 * @param {string} [inputSelector="#address"]
 * @param {string} [buttonSelector="#searchAddress"]
 */
export function bindAddressSearch(
  setMarker,
  inputSelector = "#address",
  buttonSelector = "#searchAddress"
) {
  const input = $(inputSelector);
  const button = $(buttonSelector);
  if (!input || !button) return;

  button.addEventListener("click", async () => {
    const q = input.value.trim();
    if (!q) return;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          q
        )}`
      );
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) {
        alert("Location not found.");
        return;
      }
      const { lat, lon } = data[0];
      setMarker(parseFloat(lat), parseFloat(lon));
    } catch (err) {
      console.error("Address lookup failed:", err);
      alert("Location lookup failed: " + err.message);
    }
  });
}
