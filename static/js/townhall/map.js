// /static/js/townhall/map.js
console.log("🧭 Townhall Map JS loaded");

document.addEventListener("DOMContentLoaded", () => {
  const mapEl = document.getElementById("townhall-map");
  if (!mapEl) {
    console.error("❌ No map container found.");
    return;
  }

  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error("❌ Firebase or Firestore not loaded.");
    return;
  }

  const db = firebase.firestore();
  const map = L.map("townhall-map").setView([42.8666, -106.3131], 6); // WY

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);

  const markerCluster = L.markerClusterGroup(); // 📍 Cluster support
  map.addLayer(markerCluster);

  // 🧭 Load threads and add markers
  db.collection("townhall_threads")
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data();
        const coords = data.coordinates;

        if (coords && coords.lat && coords.lng) {
          const marker = L.marker([coords.lat, coords.lng]);
          marker.bindPopup(`
            <strong>${data.title || "Untitled"}</strong><br />
            ${data.location || "Unknown"}<br />
            <a href="/townhall/thread/${doc.id}">View Thread →</a>
          `);
          markerCluster.addLayer(marker);
        }
      });
    })
    .catch(err => {
      console.error("❌ Failed to load thread markers:", err);
    });

  // 🔍 Zoom to ZIP (basic)
  window.zoomToZip = function () {
    const zip = document.getElementById("zip-input").value.trim();
    if (!zip) return;

    fetch(`https://api.zippopotam.us/us/${zip}`)
      .then(res => res.json())
      .then(data => {
        const place = data.places[0];
        const lat = parseFloat(place.latitude);
        const lng = parseFloat(place.longitude);
        map.setView([lat, lng], 11);
      })
      .catch(() => {
        alert("❌ Could not find location for ZIP code.");
      });
  };
});
