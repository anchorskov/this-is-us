// worker/src/utils/helpers.mjs

/**
 * Determine if the environment is local based on the request host header.
 * @param {Request} request
 * @returns {boolean}
 */
export function isLocalEnv(request) {
  const host = (request.headers.get('host') || '').toLowerCase();
  return host.includes('localhost') || host.startsWith('127.');
}

/**
 * Derive a safe origin for a given request.
 * Useful when constructing R2-accessible URLs.
 * @param {Request} request
 * @returns {string}
 */
// utils/helpers.mjs
export function getSafeOrigin(request) {
  try {
    const originHeader = request.headers.get("Origin");
    if (originHeader && originHeader.startsWith("http")) {
      return originHeader.replace(/\/$/, ''); // strip trailing slash
    }

    const forwardedProto = request.headers.get("X-Forwarded-Proto") || "https";
    const host = request.headers.get("Host");
    if (host) {
      return `${forwardedProto}://${host}`.replace(/\/$/, '');
    }

    const url = new URL(request.url);
    return `${url.protocol}//${url.hostname}`.replace(/\/$/, '');
  } catch (err) {
    console.warn("⚠️ Could not determine origin from request:", request.url, err);
    return 'https://this-is-us.org';
  }
}


/**
 * Validate and coerce latitude and longitude.
 * @param {string|number|null} lat
 * @param {string|number|null} lng
 * @returns {{ lat: number|null, lng: number|null }}
 */
export function validateCoords(lat, lng) {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  if (isNaN(latNum) || isNaN(lngNum)) {
    return { lat: null, lng: null };
  }
  return { lat: latNum, lng: lngNum };
}
