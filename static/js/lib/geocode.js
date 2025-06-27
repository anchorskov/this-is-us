// static/js/lib/geocode.js – returns {lat, lon} or null
const UA = 'this-is-us-dev/0.1 (+https://this-is-us.org)';

async function geocode(query) {
  const fetchJSON = url =>
    fetch(url, { headers:{Accept:'application/json','User-Agent':UA} })
      .then(r => (r.ok ? r.json() : []));

  // 1️⃣ full text search first
  let url  = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  let data = await fetchJSON(url);

  // 2️⃣ ZIP fallback if empty and query looks like 5‑digit ZIP
  if ((!data.length) && /^\d{5}$/.test(query)) {
    url  = `https://nominatim.openstreetmap.org/search?postalcode=${query}&country=US&format=json&limit=1`;
    data = await fetchJSON(url);
  }

  return data.length ? { lat:+data[0].lat, lon:+data[0].lon } : null;
}

export default geocode;
