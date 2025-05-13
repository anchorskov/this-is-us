// static/js/events/hub.js

import { safeFetch } from '../utils/safe-fetch.js';
import { showError } from './ui-feedback.js';

async function initHub() {
  const mapEl  = document.getElementById('map');
  const listEl = document.getElementById('events-list');
  if (!mapEl || !listEl) {
    console.log('⚠️ hub.js: no map or list container found, skipping.');
    return;
  }

  // 1) Initialize Leaflet map
  const map = L.map(mapEl).setView([43.0, -107.5], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // 2) Fetch & render events
  const apiBase   = (window.EVENTS_API_URL || '').replace(/\/$/, '');
  const eventsUrl = `${apiBase}/events`;

  try {
    // safeFetch will throw on non-2xx or JSON parse errors
    const events = await safeFetch(eventsUrl, {
      mode: 'cors',
      headers: { 'Accept': 'application/json' }
    });

    // empty‑state
    if (!events.length) {
      listEl.innerHTML = `
        <p class="tc gray">
          No upcoming events at the moment. Check back soon!
        </p>
      `;
      return;
    }

    // clear any old cards
    listEl.innerHTML = '';

    // place markers & cards
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

      // build the card
      const card = document.createElement('div');
      card.className = 'bg-white br2 pa3 mb4 shadow-1';
      card.innerHTML = `
        <h3 class="f4 mb2">${evt.name}</h3>
        <time datetime="${d.toISOString()}">
          ${d.toLocaleDateString()}
        </time>
        <p class="mt2">${evt.location}</p>
        <a class="link blue mt3 db" href="${evt.pdf_url}" target="_blank">
          Details →
        </a>
      `;
      card.addEventListener('click', () => {
        if (evt.lat && evt.lng) {
          map.panTo([evt.lat, evt.lng], { animate: true });
        }
      });
      listEl.appendChild(card);
    });

  } catch (err) {
    console.error('Failed to load events:', err);
    showError('Could not load events. Please try again later.');
    listEl.innerHTML = `
      <p class="tc red">
        There was a problem loading events.
      </p>
    `;
  }

  // 3) Wire map/list toggle
  const toggle = document.getElementById('view-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const showingMap = mapEl.style.display !== 'none';
      mapEl.style.display  = showingMap ? 'none' : '';
      listEl.style.display = showingMap ? 'block' : 'none';
      toggle.textContent   = showingMap
        ? 'Select Map View'
        : 'Select List View';
    });
  }

  // 4) ZIP → zoom functionality, with toast errors
  const zipInput = document.getElementById('zip-input');
  const zoomBtn  = document.getElementById('zip-zoom');

  async function zoomToZip() {
    const zip = zipInput.value.trim();
    if (!zip) return;

    const nomiUrl = `https://nominatim.openstreetmap.org/search\
?postalcode=${zip}&country=US&format=json&limit=1`;

    try {
      const results = await safeFetch(nomiUrl, {
        headers: { 'Accept': 'application/json' }
      });
      if (results.length) {
        const { lat, lon } = results[0];
        map.setView([parseFloat(lat), parseFloat(lon)], 12);
      } else {
        showError('Could not find a location for that ZIP code.');
      }
    } catch (geocodeErr) {
      console.error('Geocoding error:', geocodeErr);
      showError('Error looking up that ZIP code. Please try again.');
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
}

document.addEventListener('DOMContentLoaded', initHub);
