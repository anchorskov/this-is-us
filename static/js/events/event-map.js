// static/js/events/event-map.js
// Improved: single-instance guard + park/field accuracy bypass
import { showError } from './ui-feedback.js';

const $             = sel => document.querySelector(sel);
const DEFAULT_VIEW  = [39.5, -98.35];
const DEFAULT_ZOOM  = 4;
const TILE_URL      = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/* ──────────────────────────────────────────────────────────────
 * module-level cache – prevents duplicate Leaflet instances
 * ──────────────────────────────────────────────────────────── */
let _cached = null;

/* ------------------------------------------------------------------
 * initMap() – creates the map or hands back the cached one
 * ----------------------------------------------------------------*/
export function initMap (
  mapSelector = '#map',
  view        = DEFAULT_VIEW,
  zoom        = DEFAULT_ZOOM
) {
  /* 0️⃣ already initialised earlier in this page-load? */
  if (_cached) return _cached;

  /* 1️⃣ locate container - and bail if missing */
  const el = $(mapSelector);
  if (!el) throw new Error(`Map container ${mapSelector} not found`);

  /* 2️⃣ If this <div> already hosts a Leaflet map (because some
        other script built it), return that instead of crashing. */
  if (el._leaflet_map) {
    return _cached = {                      // also store in module cache
      map       : el._leaflet_map,
      setMarker : el._leaflet_setMarker
    };
  }

  /* 3️⃣ build a fresh map */
  const id  = mapSelector.startsWith('#') ? mapSelector.slice(1) : mapSelector;
  const map = L.map(id).setView(view, zoom);
  setTimeout(() => map.invalidateSize(), 0);      // fix 0×0 on hidden load

  L.tileLayer(TILE_URL).addTo(map);
  const markerGroup = L.layerGroup().addTo(map);

  /* helper to place / drag marker & sync hidden inputs */
  function setMarker(lat, lon) {
    const latIn = $('#lat');
    const lonIn = $('#lng');

    markerGroup.clearLayers();
    const marker = L.marker([lat, lon], { draggable: true }).addTo(markerGroup);

    const sync = ({ lat, lng }) => {
      if (latIn) latIn.value = +lat;
      if (lonIn) lonIn.value = +lng;
      console.log('📝 stored →', latIn?.value, lonIn?.value);
    };
    sync(marker.getLatLng());                      // initial
    marker.on('dragend', e => sync(e.target.getLatLng()));

    $('#loc-ok')?.focus();                         // focus “OK – Continue”
  }

  map.on('click', e => setMarker(e.latlng.lat, e.latlng.lng));

  /* 4️⃣ stash references for future reuse */
  el._leaflet_map       = map;
  el._leaflet_setMarker = setMarker;
  return (_cached = { map, setMarker });
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
  const parkChk  = $('#isPark');               // bypass accuracy filter
  if (!streetIn || !button) return;

  const fetchGeo = async url => {
    const res = await fetch(url, {
      headers: {
        Accept      : 'application/json',
        'User-Agent': 'this-is-us-dev/0.1 (+https://this-is-us.org)'
      }
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return res.json();
  };

  const triggerSearch = async () => {
    const parts = [streetIn.value, cityIn?.value, stateIn?.value, zipIn?.value]
      .map(s => (s || '').trim()).filter(Boolean);
    if (!parts.length) return;

    let url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(parts.join(', '))}`;
    console.log('🌐 Nominatim →', url);

    try {
      let data = await fetchGeo(url);

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

      const pref = ['house', 'building'];    // street-level hits
      const hit  = parkChk?.checked ? data[0] : (data.find(r => pref.includes(r.type)) || data[0]);

      console.log('📍 geocoder hit →', hit.lat, hit.lon, hit.display_name);
      onSelect(+hit.lat, +hit.lon);
    } catch (err) {
      console.error('Address lookup failed:', err);
      showError('Problem reaching location service.');
    }
  };

  button.addEventListener('click', triggerSearch);
  [streetIn, zipIn, cityIn, stateIn].forEach(el =>
    el?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); triggerSearch(); } })
  );
}
