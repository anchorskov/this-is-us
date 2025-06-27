// static/js/lib/map-init.js
// Named export → import { initLeaflet } from '../../lib/map-init.js'

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Initialise Leaflet, return { map, setMarker, setView }.
 * @param {string}   selector  e.g. '#map'
 * @param {[number,number]} view    [lat, lon]
 * @param {number}   zoom
 */
export function initLeaflet(selector = '#map', view = [39.5, -98.35], zoom = 4) {
  const id  = selector.startsWith('#') ? selector.slice(1) : selector;
  const map = L.map(id).setView(view, zoom);
  L.tileLayer(TILE_URL).addTo(map);

  const group = L.layerGroup().addTo(map);

  function setMarker(lat, lon) {
    group.clearLayers();
    L.marker([lat, lon]).addTo(group);
    map.setView([lat, lon], 15);
    document.dispatchEvent(new Event('locationSet'));
  }

  return {
    map,
    setMarker,
    setView: (lat, lon, z = 12) => map.setView([lat, lon], z),
  };
}
