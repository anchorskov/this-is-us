// static/js/events/event-map.js – selectors first, callback third
import { showError } from './ui-feedback.js';

// ——————————————————————————————————————————
// Tiny helper
// ——————————————————————————————————————————
const $ = sel => document.querySelector(sel);

// ——————————————————————————————————————————
// Defaults
// ——————————————————————————————————————————
const DEFAULT_VIEW = [39.5, -98.35];
const DEFAULT_ZOOM = 4;
const TILE_URL     = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/* ------------------------------------------------------------------
 * initMap → returns { map, setMarker }
 * ----------------------------------------------------------------*/
export function initMap (
  mapSelector = '#map',
  view        = DEFAULT_VIEW,
  zoom        = DEFAULT_ZOOM
) {
  const el = $(mapSelector);
  if (!el) throw new Error(`Map container ${mapSelector} not found`);

  const id  = mapSelector.startsWith('#') ? mapSelector.slice(1) : mapSelector;
  const map = L.map(id).setView(view, zoom);
  setTimeout(() => map.invalidateSize(), 0);

  L.tileLayer(TILE_URL).addTo(map);
  const markerGroup = L.layerGroup().addTo(map);

  function setMarker (lat, lng) {
    const latEl = $('#lat');
    const lngEl = $('#lng');
    if (latEl) latEl.value = lat;
    if (lngEl) lngEl.value = lng;
    markerGroup.clearLayers();
    L.marker([lat, lng]).addTo(markerGroup);
    document.dispatchEvent(new Event('locationSet'));
  }

  map.on('click', e => setMarker(e.latlng.lat, e.latlng.lng));

  return { map, setMarker };
}

/* ------------------------------------------------------------------
 * bindAddressSearch(inputSel, buttonSel, onSelect)
 * ----------------------------------------------------------------*/
export function bindAddressSearch (
  inputSel   = '#address',
  buttonSel  = '#searchAddress',
  onSelect   = () => {}
) {
  const input  = $(inputSel);
  const button = $(buttonSel);
  if (!input || !button) return;

  button.addEventListener('click', async () => {
    const q = input.value.trim();
    if (!q) return;

    try {
      const url  = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const data = await (await fetch(url)).json();
      if (!data.length) return showError('Location not found.');
      const { lat, lon } = data[0];
      onSelect(+lat, +lon);
    } catch (err) {
      console.error('Address lookup failed:', err);
      showError('Problem reaching location service.');
    }
  });
}
