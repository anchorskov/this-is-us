// static/js/lib/zip-info.js – ZIP → {city,state} helper (cached)

const CACHE = new Map();               // simple in‑memory cache per session
const UA    = 'this-is-us-dev/0.1 (+https://this-is-us.org)';

export async function getCityState(zip) {
  if (!/^\d{5}$/.test(zip)) return null;
  if (CACHE.has(zip)) return CACHE.get(zip);   // quick return

  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      headers:{ 'User-Agent': UA }
    });
    if (!res.ok) return null;                  // 404 = bad ZIP

    const data   = await res.json();
    const place  = data.places?.[0];
    const result = place ? { city: place['place name'], state: place['state abbreviation'] } : null;

    CACHE.set(zip, result);
    return result;
  } catch (err) {
    console.warn('getCityState failed:', err);
    return null;
  }
}
