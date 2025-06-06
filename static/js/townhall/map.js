/* ──────────────────────────────────────────────────────────────
   static/js/townhall/map.js
   Controller for /townhall/map/  (clustered Leaflet view)
   ──────────────────────────────────────────────────────────── */

console.log("🧭 townhall/map.js loaded");

document.addEventListener("DOMContentLoaded", async () => {
  /* ── helpers ─────────────────────────────────────────────── */
  const debounce = (fn, ms = 300) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(_ => fn.apply(this, a), ms); };
  };

  /* ── 0. Pre-flight ───────────────────────────────────────── */
  const mapEl = document.getElementById("townhall-map");
  if (!mapEl)                 { console.warn("🔕 No #townhall-map element"); return; }
  if (!window.L)              { console.error("❌ Leaflet not loaded");      return; }
  if (!firebase?.firestore)   { console.error("❌ Firebase not ready");      return; }

  /* ── 1. Map & tile-layer ─────────────────────────────────── */
  const map = L.map(mapEl, { scrollWheelZoom: false })
               .setView([42.8666, -106.3131], 6);        // default → Wyoming
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  /* ── 2. Cluster layer (load on-demand) ───────────────────── */
  let markerHolder;     // pointer to object we’ll add markers to

  async function ensureCluster() {
    if (window.L.markerClusterGroup) {
      return Promise.resolve();
    }
    // load the plugin only once
    if (!ensureCluster.promise) {
      console.log("📦 Loading leaflet.markercluster …");
      ensureCluster.promise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src   = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
        s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
      });
    }
    return ensureCluster.promise;
  }

  await ensureCluster().catch(() => console.warn("ℹ️ Cluster plugin failed; falling back to plain markers"));

  markerHolder = window.L.markerClusterGroup ? L.markerClusterGroup() : map;
  if (markerHolder !== map) map.addLayer(markerHolder);

  /* ── 3. Realtime Firestore stream ────────────────────────── */
  const db      = firebase.firestore();
  const bounds  = L.latLngBounds([]);

  db.collection("townhall_threads").onSnapshot(snap => {
    // clear old markers
    if (markerHolder.clearLayers) markerHolder.clearLayers();

    snap.forEach(doc => {
      const t = doc.data();
      const { lat, lng } = t.coordinates || {};
      if (typeof lat !== "number" || typeof lng !== "number") return;

      const marker = L.marker([lat, lng]).bindPopup(`
        <strong>${t.title || "Untitled"}</strong><br>
        ${t.location || "Unknown"}<br>
        <a class="text-blue-600 underline" href="/townhall/thread/${doc.id}">Open&nbsp;↗</a>`
      );

      markerHolder.addLayer ? markerHolder.addLayer(marker) : marker.addTo(map);
      bounds.extend(marker.getLatLng());
    });

    if (bounds.isValid()) map.fitBounds(bounds.pad(0.25));
  }, err => console.error("🚨 Firestore listener error:", err));

  /* ── 4. ZIP-code quick-zoom ──────────────────────────────── */
  const zipInput = document.getElementById("zip-input"),
        zipBtn   = document.getElementById("zoom-btn");

  async function zoomToZip(zip) {
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!res.ok) throw new Error("ZIP not found");
      const { places:[p] } = await res.json();
      map.setView([+p.latitude, +p.longitude], 11);
    } catch (e) {
      alert("❌ Couldn’t find that ZIP code");
      console.warn(e);
    }
  }

  if (zipBtn && zipInput) {
    zipBtn.addEventListener("click", () => {
      const z = zipInput.value.trim();
      if (z) zoomToZip(z);
    });
    zipInput.addEventListener("keyup", debounce(e => {
      if (e.key === "Enter") zoomToZip(zipInput.value.trim());
    }, 500));
  }

  /* ── 5. Auto-zoom to user’s home ZIP (if stored) ─────────── */
  firebase.auth().onAuthStateChanged(async user => {
    if (!user) return;
    try {
      const prof = await db.collection("profiles").doc(user.uid).get();
      const zip  = prof.exists && prof.data().homeZip;
      if (zip && !zipInput?.value) {            // only if user hasn’t typed
        zipInput && (zipInput.value = zip);
        zoomToZip(zip);
        console.log("📍 Auto-zoomed to user’s ZIP:", zip);
      }
    } catch (e) { console.warn("Profile lookup failed:", e); }
  });
});
