// static/js/events/populate-map.js

/**
 * Fetch and render event pins on a Leaflet map instance.
 * Assumes `L.map()` was already called and a `map` instance is available.
 * @param {L.Map} map - Leaflet map instance
 */
export async function populateMap(map) {
  const url = (window.EVENTS_API_URL || "/api") + "/events";

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch events.");
    const events = await res.json();

    if (!Array.isArray(events)) {
      console.warn("⚠️ Unexpected events format", events);
      return;
    }

    events.forEach(ev => {
      if (ev.lat && ev.lng) {
        const marker = L.marker([ev.lat, ev.lng]).addTo(map);
        const popup = `<strong>${ev.name}</strong><br>${ev.location}<br>${ev.date}`;
        marker.bindPopup(popup);
      }
    });

    console.log(`📍 Rendered ${events.length} event markers`);
  } catch (err) {
    console.error("❌ Failed to populate map:", err.message);
  }
}
