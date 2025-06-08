/* ──────────────────────────────────────────────────────────────
   static/js/townhall/map.js – controller for /townhall/map/
   ──────────────────────────────────────────────────────────── */

console.log("🧭 townhall/map.js loaded");

document.addEventListener("DOMContentLoaded", async () => {

  /* helper -------------------------------------------------- */
  const debounce = (fn, ms = 400) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  /* 0 • pre-flight ----------------------------------------- */
  const mapEl = document.getElementById("townhall-map");
  if (!mapEl)             { console.warn("🔕 #townhall-map missing"); return; }
  if (!window.L)          { console.error("❌ Leaflet not loaded");   return; }
  if (!firebase?.firestore){console.error("❌ Firebase not ready");  return; }

  /* 1 • map ------------------------------------------------- */
  const map = L.map(mapEl, { scrollWheelZoom: false })
               .setView([42.8666, -106.3131], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  /* 2 • cluster layer (load plugin once on-demand) ---------- */
  let markerLayer = map;
  if (!window.L.markerClusterGroup) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
      s.onload = () => res();
      s.onerror = () => { console.warn("ℹ️ cluster plugin failed"); res(); };
      document.head.appendChild(s);
    });
  }
  if (window.L.markerClusterGroup) {
    markerLayer = L.markerClusterGroup();
    map.addLayer(markerLayer);
  }

  /* 3 • realtime Firestore stream --------------------------- */
  const db     = firebase.firestore();
  const bounds = L.latLngBounds([]);

  db.collection("townhall_threads").onSnapshot(
    snap => {
      markerLayer.clearLayers?.();  // works for cluster & plain map

      snap.forEach(doc => {
        const { lat, lng } = doc.data().coordinates || {};
        if (typeof lat !== "number" || typeof lng !== "number") return;

        const m = L.marker([lat, lng]).bindPopup(`
          <strong>${doc.data().title || "Untitled"}</strong><br>
          ${doc.data().location || "Unknown"}<br>
          <a class="text-blue-600 underline" href="/townhall/thread/?id=${doc.id}">
            Open ↗
          </a>
        `);
        markerLayer.addLayer ? markerLayer.addLayer(m) : m.addTo(map);
        bounds.extend(m.getLatLng());
      });

      if (bounds.isValid()) map.fitBounds(bounds.pad(0.25));
    },
    err => console.error("🚨 Firestore listener error:", err)
  );

  /* 4 • ZIP quick-zoom ------------------------------------- */
  const zipInput = document.getElementById("zip-input");
  const zoomBtn  = document.getElementById("zoom-btn");

  async function zoomToZip(zip) {
    if (!zip) return;
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!res.ok) throw new Error("ZIP not found");
      const place = (await res.json()).places[0];
      map.setView([+place.latitude, +place.longitude], 11);
    } catch { alert("❌ Couldn’t find that ZIP code"); }
  }

  zoomBtn?.addEventListener("click", () => zoomToZip(zipInput.value.trim()));
  zipInput?.addEventListener("keyup", debounce(() => {
    if (zipInput.value.length === 5) zoomToZip(zipInput.value.trim());
  }));

  /* 5 • auto-zoom to stored home ZIP (non-fatal) ------------ */
  firebase.auth().onAuthStateChanged(async user => {
    if (!user) return;
    try {
      const doc = await db.collection("profiles").doc(user.uid).get();
      const zip = doc.exists && doc.data().homeZip;
      if (zip && !zipInput?.value) {
        zipInput && (zipInput.value = zip);
        zoomToZip(zip);
        console.log("📍 Auto-zoom to user ZIP", zip);
      }
    } catch (e) { console.warn("Profile lookup failed:", e.message); }
  });

});
