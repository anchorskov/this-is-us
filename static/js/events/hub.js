// static/js/events/hub.js

(async () => {
  const apiBase = (window.EVENTS_API_URL || '').replace(/\/$/, '');
  const eventsUrl = `${apiBase}/events`;

  // Bail if not on the Events section page
  const mapEl = document.getElementById('map');
  const listEl = document.getElementById('events-list');
  if (!mapEl || !listEl) {
    console.log('⚠️ hub.js: no map or list container found, skipping.');
    return;
  }

  try {
    console.log('🔍 Starting hub.js; will fetch from', eventsUrl);
    const res = await fetch(eventsUrl, {
      mode: 'cors',
      headers: { 'Accept': 'application/json' }
    });

    let events = [];
    if (res.status === 400) {
      console.warn('⚠️ API returned 400 Bad Request; treating as no events.');
    } else if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    } else {
      try {
        events = await res.json();
      } catch {
        console.warn('⚠️ Invalid JSON response; no events will be shown.');
      }
    }

    // Initialize Leaflet map
    const map = L.map(mapEl).setView([43.0, -107.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // No events placeholder
    if (!events.length) {
      listEl.style.display = 'block';
      listEl.innerHTML = `
        <p class="tc gray">No upcoming events at the moment. Check back soon!</p>
      `;
      return;
    }

    // Build pins and cards
    events.forEach(evt => {
      const { name, date, location, pdf_url, lat, lng } = evt;
      const d = new Date(date);

      if (lat && lng) {
        L.marker([lat, lng])
          .addTo(map)
          .bindPopup(
            `<strong>${name}</strong><br>` +
            `${d.toLocaleDateString()} – ${location}<br>` +
            `<a href="${pdf_url}" target="_blank">Details</a>`
          );
      }

      const card = document.createElement('div');
      card.className = 'bg-white br2 pa3 mb4 shadow-1';
      card.innerHTML = `
        <h3 class="f4 mb2">${name}</h3>
        <time datetime="${d.toISOString()}">${d.toLocaleDateString()}</time>
        <p class="mt2">${location}</p>
        <a class="link blue mt3 db" href="${pdf_url}" target="_blank">Details →</a>
      `;
      card.addEventListener('click', () => {
        if (lat && lng) map.panTo([lat, lng], { animate: true });
      });
      listEl.appendChild(card);
    });

    // Wire map/list toggle
    const toggle = document.getElementById('view-toggle');
    toggle.addEventListener('click', () => {
      if (mapEl.style.display !== 'none') {
        mapEl.style.display = 'none';
        listEl.style.display = 'block';
        toggle.textContent = 'Select Map View';
      } else {
        listEl.style.display = 'none';
        mapEl.style.display = '';
        toggle.textContent = 'Select List View';
      }
    });

    // Zoom to ZIP functionality
    const zipInput = document.getElementById('zip-input');
    const zoomBtn = document.getElementById('zip-zoom');
    async function zoomToZip() {
      const zip = zipInput.value.trim();
      if (!zip) return;
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`,
          { headers: { 'Accept': 'application/json' } }
        );
        const data = await resp.json();
        if (data && data.length) {
          const { lat, lon } = data[0];
          map.setView([parseFloat(lat), parseFloat(lon)], 12);
        } else {
          alert('Could not find location for that ZIP code.');
        }
      } catch (e) {
        console.error('Geocoding error', e);
        alert('Error looking up ZIP code.');
      }
    }
    if (zoomBtn) zoomBtn.addEventListener('click', zoomToZip);
    if (zipInput) {
      zipInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          zoomToZip();
        }
      });
    }

  } catch (err) {
    console.error('Failed to load events:', err);
    mapEl.innerHTML =
      '<p class="text-red-600">Could not load events. Check console for CORS or network errors.</p>';
  }
})();
