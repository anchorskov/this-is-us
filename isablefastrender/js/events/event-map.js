// static/js/events/event-map.js

import { showError } from './ui-feedback.js';

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
const TILE_URL    = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Initialize the Leaflet map and return both map instance and marker-setter.
 * @param {string} [mapSelector="#map"]
 * @param {[number,number]} [view=DEFAULT_VIEW]
 * @param {number} [zoom=DEFAULT_ZOOM]
 */
export function initMap(
  mapSelector = '#map',
  view        = DEFAULT_VIEW,
  zoom        = DEFAULT_ZOOM
) {
  const el = $(mapSelector);
  if (!el) throw new Error(`Map container ${mapSelector} not found`);

  // Initialize map
  const id  = mapSelector.startsWith('#') ? mapSelector.slice(1) : mapSelector;
  const map = L.map(id).setView(view, zoom);
  setTimeout(() => map.invalidateSize(), 0);

  L.tileLayer(TILE_URL).addTo(map);
  const markerGroup = L.layerGroup().addTo(map);

  /** Place a marker and populate hidden lat/lng inputs. */
  function setMarker(lat, lng) {
    const latInput = $('#lat');
    const lngInput = $('#lng');
    if (latInput) latInput.value = lat;
    if (lngInput) lngInput.value = lng;
    markerGroup.clearLayers();
    L.marker([lat, lng]).addTo(markerGroup);
    // Notify form logic
    document.dispatchEvent(new Event('locationSet'));
  }

  // Click on map to set marker
  map.on('click', (e) => {
    setMarker(e.latlng.lat, e.latlng.lng);
  });

  return { map, setMarker };
}

/**
 * Bind an address search box to your map’s marker setter.
 * @param {function} setMarker – from initMap()
 * @param {string}   [inputSelector="#address"]
 * @param {string}   [buttonSelector="#searchAddress"]
 */
export function bindAddressSearch(
  setMarker,
  inputSelector  = '#address',
  buttonSelector = '#searchAddress'
) {
  const input  = $(inputSelector);
  const button = $(buttonSelector);
  if (!input || !button) return;

  button.addEventListener('click', async () => {
    const query = input.value.trim();
    if (!query) return;

    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) {
        showError('Location not found.');
        return;
      }
      const { lat, lon } = data[0];
      setMarker(parseFloat(lat), parseFloat(lon));
    } catch (err) {
      console.error('Address lookup failed:', err);
      showError('Location lookup failed: ' + err.message);
    }
  });
}
