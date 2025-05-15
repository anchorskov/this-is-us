// static/js/events/hub.js

import { safeFetch } from '../utils/safe-fetch.js';
import { showError } from './ui-feedback.js';

async function initHub() {
  console.log('🚀 initHub() running');

  const mapEl = document.getElementById('map');
  const listEl = document.getElementById('events-list');
  const zipInput = document.getElementById('zip-input');
  const zoomBtn = document.getElementById('zip-zoom');
  const toggle = document.getElementById('view-toggle');

  console.log('🧩 DOM Check:', { mapEl, listEl, zipInput, zoomBtn, toggle });

  if (!mapEl || !listEl) {
    console.warn('⚠️ hub.js: missing #map or #events-list — skipping init');
    return;
  }

  // 🔄 Delay map initialization slightly to ensure CSS and script readiness
  setTimeout(() => {
    if (mapEl._leaflet_id) {
      console.warn('🧹 Resetting existing Leaflet map instance');
      mapEl._leaflet_id = null;
    }

    const map = L.map(mapEl).setView([43.0, -107.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Load events and markers
    const apiBase = (window.EVENTS_API_URL || '').replace(/\/$/, '');
    const eventsUrl = `${apiBase}/events`;

    safeFetch(eventsUrl, {
      mode: 'cors',
      headers: { 'Accept': 'application/json' }
    }).then(events => {
      if (!events.length) {
        listEl.innerHTML = `<p class="tc gray">No upcoming events at the moment. Check back soon!</p>`;
        return;
      }

      listEl.innerHTML = '';
      events.forEach(evt => {
        const d = new Date(evt.date);

        if (evt.lat && evt.lng) {
          L.marker([evt.lat, evt.lng])
            .addTo(map)
            .bindPopup(`
              <strong>${evt.name}</strong><br>
              ${d.toLocaleDateString()} – ${evt.location}<br>
              <a href="${evt.pdf_url}" target="_blank">Details</a>
            `);
        }

        const card = document.createElement('div');
        card.className = 'bg-white br2 pa3 mb4 shadow-1';
        card.innerHTML = `
          <h3 class="f4 mb2">${evt.name}</h3>
          <time datetime="${d.toISOString()}">${d.toLocaleDateString()}</time>
          <p class="mt2">${evt.location}</p>
          <a class="link blue mt3 db" href="${evt.pdf_url}" target="_blank">Details →</a>
        `;
        card.addEventListener('click', () => {
          if (evt.lat && evt.lng) {
            map.panTo([evt.lat, evt.lng], { animate: true });
          }
        });
        listEl.appendChild(card);
      });
    }).catch(err => {
      console.error('❌ Failed to load events:', err);
      showError('Could not load events. Please try again later.');
      listEl.innerHTML = `<p class="tc red">There was a problem loading events.</p>`;
    });

    // View toggle
    if (toggle) {
      toggle.addEventListener('click', () => {
        const showingMap = mapEl.style.display !== 'none';
        mapEl.style.display = showingMap ? 'none' : '';
        listEl.style.display = showingMap ? 'block' : 'none';
        toggle.textContent = showingMap ? 'Select Map View' : 'Select List View';
        console.log(`🔄 View toggled to: ${showingMap ? 'List' : 'Map'}`);
      });
    }

    // ZIP Zoom
    async function zoomToZip() {
      const zip = zipInput?.value?.trim();
      console.log('🔍 ZIP input received:', zip);
      if (!zip) return;

      const nomiUrl = `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`;
      console.log('🌐 Fetching from:', nomiUrl);

      try {
        const results = await safeFetch(nomiUrl, {
          headers: { 'Accept': 'application/json' }
        });

        console.log('🌐 Geocode results:', results);
        if (results.length) {
          const { lat, lon } = results[0];
          map.setView([parseFloat(lat), parseFloat(lon)], 12);
          console.log(`📍 Zoomed to ZIP: ${zip} → [${lat}, ${lon}]`);
        } else {
          showError('Could not find a location for that ZIP code.');
        }
      } catch (geocodeErr) {
        console.error('❌ safeFetch failed for ZIP search:', geocodeErr);
        showError('Problem reaching the location service.');
      }
    }

    if (zoomBtn) zoomBtn.addEventListener('click', zoomToZip);
    if (zipInput) {
      zipInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          zoomToZip();
        }
      });
    }
  }, 100); // small delay to allow full DOM readiness
}

document.addEventListener('DOMContentLoaded', initHub);
