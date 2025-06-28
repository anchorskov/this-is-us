// static/js/findLatLon.js

const locationIqKey = 'pk.5c195bcb08b38195ddd852c0c0ee20fc';
const mapQuestKey = 'bSUAsn0hA7WoFW7C0n5jycZPqJ5dV4Ly';

async function queryNominatim(fullAddress) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}`;
  const headers = { 'User-Agent': 'your-app-name (your@email.com)' };

  const res = await fetch(url, { headers });
  const data = await res.json();

  if (!data || data.length === 0) throw new Error('Nominatim: No data');
  const { lat, lon, display_name } = data[0];
  return { lat: parseFloat(lat), lon: parseFloat(lon), displayName: display_name, source: 'Nominatim' };
}

async function queryLocationIQ(fullAddress) {
  const url = `https://us1.locationiq.com/v1/search?key=${locationIqKey}&q=${encodeURIComponent(fullAddress)}&format=json`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data || data.length === 0) throw new Error('LocationIQ: No data');
  const { lat, lon, display_name } = data[0];
  return { lat: parseFloat(lat), lon: parseFloat(lon), displayName: display_name, source: 'LocationIQ' };
}

async function queryMapQuest(fullAddress) {
  const url = `https://www.mapquestapi.com/geocoding/v1/address?key=${mapQuestKey}&location=${encodeURIComponent(fullAddress)}`;
  const res = await fetch(url);
  const data = await res.json();

  const loc = data.results?.[0]?.locations?.[0]?.latLng;
  if (!loc) throw new Error('MapQuest: No data');

  return {
    lat: loc.lat,
    lon: loc.lng,
    displayName: data.results[0].providedLocation.location,
    source: 'MapQuest'
  };
}

async function findLatLon(fullAddress) {
  const saveLocation = document.getElementById("saveLocation")?.checked || false;
  const attempts = [queryNominatim, queryLocationIQ, queryMapQuest];

  for (const service of attempts) {
    try {
      const result = await service(fullAddress);

      if (saveLocation) {
        console.log(`✅ Saving (${result.source})`, result);
        // Future: Save to Firestore/D1
      } else {
        console.log(`🕊️ Lookup only (${result.source})`, result);
      }

      return { ...result, saved: saveLocation };
    } catch (err) {
      console.warn(`⚠️ ${service.name} failed:`, err.message);
    }
  }

  throw new Error("All geolocation services failed.");
}

export { findLatLon };
