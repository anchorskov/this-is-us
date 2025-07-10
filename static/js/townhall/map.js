/* ──────────────────────────────────────────────────────────────
   static/js/townhall/map.js – controller for /townhall/map/
   Firebase v9 + Leaflet 1.9.4
   ──────────────────────────────────────────────────────────── */
console.log("🧭 townhall/map.js loaded (v9)");

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

/* 0 ▸ pre-flight ------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  const mapEl = document.getElementById("townhall-map");
  if (!mapEl)            return console.warn("🔕 #townhall-map missing");
  if (typeof L === "undefined")
    return console.error("❌ Leaflet not loaded");

  /* 1 ▸ Leaflet map --------------------------------------------------- */
  const map = L.map(mapEl, { scrollWheelZoom: false }).setView(
    [42.8666, -106.3131],
    6
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  /* cluster plugin (lazy-load) --------------------------------------- */
  let markerLayer = map;
  if (!window.L.markerClusterGroup) {
    await new Promise((res) => {
      const s = document.createElement("script");
      s.src =
        "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
      s.onload = res;
      s.onerror = () => {
        console.warn("ℹ️  cluster plugin failed, continuing without it"); res();
      };
      document.head.appendChild(s);
    });
  }
  if (window.L.markerClusterGroup) {
    markerLayer = L.markerClusterGroup();
    map.addLayer(markerLayer);
  }

  /* 2 ▸ Firestore realtime stream ----------------------------------- */
  const db   = getFirestore();
  const auth = getAuth();
  const bounds = L.latLngBounds([]);

  onSnapshot(collection(db, "townhall_threads"), (snap) => {
    markerLayer.clearLayers?.();
    bounds.clear();

    snap.forEach((d) => {
      const { lat, lng } = d.data().coordinates || {};
      if (typeof lat !== "number" || typeof lng !== "number") return;

      const m = L.marker([lat, lng]).bindPopup(`
        <strong>${d.data().title || "Untitled"}</strong><br>
        ${d.data().location || "Unknown"}<br>
        <a href="/townhall/thread/${d.id}/" class="text-blue-600 underline">Open ↗</a>
      `);

      markerLayer.addLayer ? markerLayer.addLayer(m) : m.addTo(map);
      bounds.extend(m.getLatLng());
    });

    if (bounds.isValid()) map.fitBounds(bounds.pad(0.25));
  }, (err) => console.error("🚨 Firestore listener error:", err));

  /* 3 ▸ ZIP quick-zoom ---------------------------------------------- */
  const debounce = (fn, ms = 400) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  const zipInput = document.getElementById("zip-input");
  const zoomBtn  = document.getElementById("zoom-btn");

  async function zoomToZip(zip) {
    if (!zip) return;
    try {
      const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!r.ok) throw new Error("ZIP not found");
      const place = (await r.json()).places[0];
      map.setView([+place.latitude, +place.longitude], 11);
    } catch {
      alert("❌ Couldn’t find that ZIP code");
    }
  }

  zoomBtn?.addEventListener("click", () => zoomToZip(zipInput.value.trim()));
  zipInput?.addEventListener(
    "keyup",
    debounce(() => {
      if (zipInput.value.length === 5) zoomToZip(zipInput.value.trim());
    })
  );

  /* 4 ▸ Auto-zoom to stored home ZIP ------------------------------- */
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, "profiles", user.uid));
      const zip  = snap.exists() && snap.data().homeZip;
      if (zip && !zipInput?.value) {
        zipInput.value = zip;
        zoomToZip(zip);
        console.log("📍 Auto-zoom to user ZIP", zip);
      }
    } catch (e) {
      console.warn("Profile lookup failed:", e.message);
    }
  });
});
