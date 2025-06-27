// static/js/events/event-map.js – improved accuracy + “Park / open-field” bypass

import { showError } from './ui-feedback.js';

const $ = sel => document.querySelector(sel);
const DEFAULT_VIEW = [39.5, -98.35];
const DEFAULT_ZOOM = 4;
const TILE_URL     = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/* ------------------------------------------------------------------
 * Map bootstrap
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

  function setMarker(lat, lon) {
  const latIn = $('#lat');
  const lonIn = $('#lng');

  markerGroup.clearLayers();

  // draggable marker
  const marker = L.marker([lat, lon], { draggable: true }).addTo(markerGroup);

  // sync hidden inputs
  function sync({ lat, lng }) {
    if (latIn) latIn.value = +lat;
    if (lonIn) lonIn.value = +lng;
    console.log('📝 stored →', latIn.value, lonIn.value);
  }
  sync(marker.getLatLng());                 // initial

  marker.on('dragend', e => sync(e.target.getLatLng()));

  // focus the OK button after first placement
  $('#loc-ok')?.focus();
}

  map.on('click', e => setMarker(e.latlng.lat, e.latlng.lng));
  return { map, setMarker };
}

/* ------------------------------------------------------------------
 * Address / ZIP search helper
 * ----------------------------------------------------------------*/
export function bindAddressSearch (
  inputSel  = '#address',
  buttonSel = '#searchAddress',
  onSelect  = () => {}
) {
  const streetIn = $(inputSel);
  const zipIn    = $('#zip');
  const cityIn   = $('#city');
  const stateIn  = $('#state');
  const button   = $(buttonSel);
  const parkChk  = $('#isPark');           // skip accuracy filter if checked
  if (!streetIn || !button) return;

  const fetchGeo = async url => {
    const res = await fetch(url, {
      headers: {
        Accept     : 'application/json',
        'User-Agent': 'this-is-us-dev/0.1 (+https://this-is-us.org)'
      }
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  };

  const triggerSearch = async () => {
    // concat Street + City + State + ZIP
    const parts = [streetIn.value, cityIn?.value, stateIn?.value, zipIn?.value]
      .map(s => (s || '').trim())
      .filter(Boolean);
    const q = parts.join(', ');
    if (!q) return;

    let url  = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
    console.log('🌐 Nominatim request →', url);

    try {
      let data = await fetchGeo(url);

      // ZIP fallback if nothing and a 5-digit ZIP present
      const zipOnly = (zipIn?.value || '').trim();
      if (!data.length && /^\d{5}$/.test(zipOnly)) {
        url  = `https://nominatim.openstreetmap.org/search?postalcode=${zipOnly}&country=US&format=json&limit=1`;
        console.log('🌐 ZIP fallback →', url);
        data = await fetchGeo(url);
      }

      if (!data.length) {
        showError('Location not found. Try a fuller address or click the map.');
        return;
      }

      // choose best hit
      let hit;
      if (parkChk?.checked) {
        hit = data[0];                                 // accept centroid
      } else {
        const pref = ['house', 'building'];            // street-level types
        hit = data.find(r => pref.includes(r.type)) || data[0];
      }

      console.log('📍 geocoder hit →', hit.lat, hit.lon, hit.display_name);
      onSelect(+hit.lat, +hit.lon);
    } catch (err) {
      console.error('Address lookup failed:', err);
      showError('Problem reaching location service.');
    }
  };

  button.addEventListener('click', triggerSearch);

  // Enter-key triggers search
  [streetIn, zipIn, cityIn, stateIn].forEach(el => {
    el?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerSearch();
      }
    });
  });
}
