// static/js/events/hub.js – address‑first zoom logic
import { safeFetch } from '../utils/safe-fetch.js';
import { showError }   from './ui-feedback.js';
import { parseLatLng } from '../utils/parse-latlng.js';

let mapInstance;

// ──────────────────────────────────────────────────────────────
// 1 ▪ Render markers + cards from API
// ──────────────────────────────────────────────────────────────
async function renderEvents (map, listEl) {
  const apiBase   = (window.EVENTS_API_URL || '').replace(/\/$/, '');
  const eventsUrl = `${apiBase}/events`;
  const markerCache = new Map();

  try {
    const events = await safeFetch(eventsUrl, {
      mode    : 'cors',
      headers : { 'Accept': 'application/json' }
    });

    console.log('📦 Fetched events:', events);

    if (!events.length) {
      listEl.innerHTML = '<p class="tc gray">No upcoming events at the moment. Check back soon!</p>';
      return;
    }

    listEl.innerHTML = '';
    events.forEach(evt => {
      const d = new Date(evt.date);
      const { lat, lng } = parseLatLng(evt.lat, evt.lng);

      // Stack markers with a slight offset to avoid exact overlap
      if (lat !== null && lng !== null) {
        const key   = `${lat},${lng}`;
        const count = markerCache.get(key) || 0;
        markerCache.set(key, count + 1);

        const offsetLat = lat + 0.0003 * count;
        const offsetLng = lng + 0.0003 * count;

        L.marker([offsetLat, offsetLng])
          .addTo(map)
          .bindPopup(`
            <strong>${evt.name}</strong><br>
            ${d.toLocaleDateString()} – ${evt.location}<br>
            <a href="${evt.pdf_url}" target="_blank">Details</a>
          `);
      }

      // Build card in the side list
      const card = document.createElement('div');
      card.className = 'bg-white br2 pa3 mb4 shadow-1';
      card.innerHTML = `
        <h3 class="f4 mb2">${evt.name}</h3>
        <time datetime="${d.toISOString()}">${d.toLocaleDateString()}</time>
        <p class="mt2">${evt.location}</p>
        <a class="link blue mt3 db" href="${evt.pdf_url}" target="_blank">Details →</a>
      `;
      card.addEventListener('click', () => {
        if (lat !== null && lng !== null) {
          map.panTo([lat, lng], { animate: true });
        }
      });

      listEl.appendChild(card);
    });

    console.log(`📍 Rendered ${events.length} markers`);
  } catch (err) {
    console.error('❌ Failed to load events:', err);
    showError('Could not load events. Please try again later.');
    listEl.innerHTML = '<p class="tc red">There was a problem loading events.</p>';
  }
}

// ──────────────────────────────────────────────────────────────
// 2 ▪ Main initialiser
// ──────────────────────────────────────────────────────────────
function initHub () {
  console.log('🚀 initHub() running');

  const mapEl     = document.getElementById('map');
  const listEl    = document.getElementById('events-list');
  const addrInput = document.getElementById('addr-input');
  const searchBtn = document.getElementById('addr-search');
  const toggle    = document.getElementById('view-toggle');

  console.log('🧩 DOM Check:', { mapEl, listEl, addrInput, searchBtn, toggle });

  if (!mapEl || !listEl) {
    console.warn('⚠️ hub.js: missing #map or #events-list — skipping init');
    return;
  }

  // Defer slightly so the container is fully rendered
  setTimeout(() => {
    if (mapEl._leaflet_id || mapInstance) {
      console.warn('🧹 Existing Leaflet instance reset');
      mapEl._leaflet_id = null;
    }

    mapInstance = L.map(mapEl).setView([43.0, -107.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance);

    renderEvents(mapInstance, listEl);

    // Toggle list / map view
    if (toggle) {
      toggle.addEventListener('click', () => {
        const showingMap = mapEl.style.display !== 'none';
        mapEl.style.display  = showingMap ? 'none' : '';
        listEl.style.display = showingMap ? 'block' : 'none';
        toggle.textContent   = showingMap ? 'Select Map View' : 'Select List View';
      });
    }

    // ── Address → coords helper ──
    const WY_REGEX = /\bwy(oming)?\b/i;

    function ensureWyoming(query) {
      if (!query) return query;
      return WY_REGEX.test(query) ? query : `${query}, Wyoming`;
    }

    function buildGeoUrl(query, bounded = true) {
      const params = new URLSearchParams({
        format       : 'json',
        limit        : '5',
        q            : query,
        countrycodes : 'us'
      });

      if (bounded && mapInstance) {
        const bounds = mapInstance.getBounds();
        params.set(
          'viewbox',
          `${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()},${bounds.getSouth()}`
        );
        params.set('bounded', '1');
      }

      return `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    }

    async function geocode (query, bounded = true) {
      const url = buildGeoUrl(query, bounded);
      return safeFetch(url, { headers:{Accept:'application/json'} });
    }

    // ── Address-first, ZIP‑fallback zoom ──
    function fitResult(hit, fallbackZoom = 15) {
      if (!hit) return;
      const lat = +hit.lat;
      const lon = +hit.lon;
      if (hit.boundingbox && hit.boundingbox.length === 4) {
        const [south, north, west, east] = hit.boundingbox.map(Number);
        mapInstance.fitBounds([[south, west], [north, east]]);
      } else {
        mapInstance.setView([lat, lon], fallbackZoom);
      }
    }

    async function zoomToAddress () {
      const raw = addrInput?.value?.trim();
      console.log('🔍 Address input:', raw);
      if (!raw) return;

      const isZip = /^\d{5}$/.test(raw);
      const normalized = isZip ? raw : ensureWyoming(raw);

      let results = await geocode(normalized, true);
      if (!results.length) {
        results = await geocode(normalized, false);
      }

      if (!results.length && isZip) {
        const zipUrl = `https://nominatim.openstreetmap.org/search?postalcode=${raw}&country=US&format=json&limit=1`;
        results = await safeFetch(zipUrl, { headers:{Accept:'application/json'} });
      }

      if (results.length) {
        const hit = results[0];
        const zoomLevel = isZip ? 12 : 15;
        fitResult(hit, zoomLevel);
        console.log(`📍 Zoomed to ${normalized} → [${hit.lat}, ${hit.lon}]`);
      } else {
        showError('Location not found. Revise the address or click the map.');
      }
    }

    // Attach listeners
    if (searchBtn) searchBtn.addEventListener('click', zoomToAddress);
    if (addrInput) {
      addrInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          zoomToAddress();
        }
      });
    }
  }, 100);
}

document.addEventListener('DOMContentLoaded', initHub);
