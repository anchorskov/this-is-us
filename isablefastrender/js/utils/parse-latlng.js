// static/js/utils/parse-latlng.js

/**
 * Safely parse latitude and longitude from a record.
 * @param {any} lat 
 * @param {any} lng 
 * @returns {{ lat: number|null, lng: number|null }}
 */
export function parseLatLng(lat, lng) {
  const parsedLat = typeof lat === 'string' ? parseFloat(lat) : lat;
  const parsedLng = typeof lng === 'string' ? parseFloat(lng) : lng;
  const isValid = !isNaN(parsedLat) && !isNaN(parsedLng);
  return {
    lat: isValid ? parsedLat : null,
    lng: isValid ? parsedLng : null
  };
}
