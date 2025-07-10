/* ---------------------------------------------------------
   File: static/js/townhall/home.js
   Purpose: /townhall/ landing page controller (Firebase v9)
   Dependencies:
     • Leaflet 1.9.4
     • /js/utils/show-sign-in.js
 --------------------------------------------------------- */
console.log("🧠 townhall/home.js loaded (v9)");

import { showSignInGate } from "/js/utils/show-sign-in.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

/* ───── Module-level singletons ───── */
const auth = getAuth();
const db   = getFirestore();

let userLocation = null;
let map          = null;
let threadMarkers;          // Leaflet layer group (init lazily)

/* 1️⃣  DOM ready → set up UI ------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  attachTabs();
  attachLocationControls();
  loadTrending();          // default tab

  onAuthStateChanged(auth, (user) => {
    console.log("🔄 Auth state:", user ? user.email : "Not signed in");
    window.currentUser = user || null;
  });
});

/* 2️⃣  Tabs ------------------------------------------------------------ */
function attachTabs() {
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;

      /* visual state */
      document.querySelectorAll("[data-tab]").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("border-blue-600", active);
        b.classList.toggle("text-blue-600",  active);
        b.classList.toggle("border-transparent", !active);
        b.classList.toggle("text-gray-500",     !active);
      });
      document.querySelectorAll(".thread-list")
              .forEach((p) => p.classList.add("hidden"));
      document.getElementById(`tab-${tab}`).classList.remove("hidden");

      /* lazy loaders */
      if (tab === "nearby" && !userLocation) getUserLocation();
      if (tab === "mine" && !btn.dataset.loaded) {
        loadMine();
        btn.dataset.loaded = "true";
      }
    });
  });
}

/* 3️⃣  Location input & mini-map -------------------------------------- */
function attachLocationControls() {
  const input = document.getElementById("location-input");
  const btn   = document.getElementById("use-my-location");

  input?.addEventListener("input", () => {
    if (input.value.length === 5) geocode(input.value);
  });
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") geocode(input.value);
  });
  btn?.addEventListener("click", getUserLocation);
}

function showMap(lat, lng) {
  const mapEl = document.getElementById("mini-map");
  mapEl.classList.remove("hidden");

  if (typeof L === "undefined") {
    console.log("⏳ Leaflet not ready – retrying…");
    return setTimeout(() => showMap(lat, lng), 100);
  }

  if (!map) {
    threadMarkers = L.layerGroup();
    map = L.map("mini-map").setView([lat, lng], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    threadMarkers.addTo(map);
  } else {
    map.setView([lat, lng], 11);
  }
  L.marker([lat, lng]).addTo(map);

  /* fix: re-calculate map size after showing container */
  setTimeout(() => map.invalidateSize(), 10);
}

async function geocode(q) {
  if (!q || q.length < 5) return;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url).then((r) => r.json());
    if (res?.length) {
      const { lat, lon } = res[0];
      userLocation = { lat: +lat, lng: +lon };
      showMap(userLocation.lat, userLocation.lng);
      loadNearby();
    } else {
      alert("Location not found");
    }
  } catch (err) {
    console.error("Geocoding error:", err);
  }
}

/* 4️⃣  Firestore loaders ---------------------------------------------- */
async function loadTrending() {
  const container = document.getElementById("tab-trending");
  container.innerHTML = "<p class='text-gray-500'>Loading trending threads…</p>";

  try {
    const q  = query(collection(db, "townhall_threads"),
                     orderBy("replyCount", "desc"), limit(10));
    const qs = await getDocs(q);
    renderThreads(qs, container);
  } catch (err) {
    console.error("Firestore (Trending):", err);
    container.innerHTML =
      "<p class='text-red-500'>Error loading threads (need index?).</p>";
  }
}

async function loadNearby() {
  if (!userLocation) return;
  const container = document.getElementById("tab-nearby");
  container.innerHTML = "<p class='text-gray-500'>Finding threads near you…</p>";

  try {
    const q  = query(collection(db, "townhall_threads"),
                     orderBy("timestamp", "desc"), limit(30));
    const qs = await getDocs(q);
    renderThreads(qs, container);
  } catch (err) {
    console.error("Firestore (Nearby):", err);
    container.innerHTML =
      "<p class='text-red-500'>Error loading nearby threads.</p>";
  }
}

async function loadMine() {
  const container = document.getElementById("tab-mine");
  if (!window.currentUser) {
    return showSignInGate({
      container,
      message: "Sign in to see the threads you've started."
    });
  }
  container.innerHTML = "<p class='text-gray-500'>Loading your threads…</p>";

  try {
    const q  = query(collection(db, "townhall_threads"),
                     where("authorUid", "==", window.currentUser.uid));
    const qs = await getDocs(q);
    renderThreads(qs, container);
  } catch (err) {
    console.error("Firestore (Mine):", err);
    container.innerHTML =
      "<p class='text-red-500'>Error loading your threads.</p>";
  }
}

/* 5️⃣  Rendering + map pins ------------------------------------------- */
function addPinsToMap(threads) {
  if (!map) return;
  threadMarkers.clearLayers();
  threads.forEach((t) => {
    if (t.lat && t.lng) {
      L.marker([t.lat, t.lng])
        .bindPopup(
          `<a class="font-bold text-blue-600" href="/townhall/thread/${t.id}/">${t.title}</a>`
        )
        .addTo(threadMarkers);
    }
  });
}

function renderThreads(qs, container) {
  if (qs.empty) {
    container.innerHTML =
      "<p class='text-gray-600 col-span-full text-center py-10'>No threads found.</p>";
    return;
  }
  container.innerHTML = "";

  const threadsForMap = [];
  qs.forEach((doc) => {
    const t = { id: doc.id, ...doc.data() };
    threadsForMap.push(t);

    const card = document.createElement("div");
    card.className =
      "bg-white shadow-lg rounded-xl p-6 border flex flex-col hover:shadow-xl transition";
    card.innerHTML = `
      <a href="/townhall/thread/${t.id}/"
         class="text-lg font-bold hover:text-blue-600">${t.title}</a>
      <p class="text-sm text-gray-500 mt-1 mb-3">${t.location || "General"}</p>
      <p class="text-gray-700 text-sm flex-grow">${(t.body || "").slice(0,120)}…</p>
      <div class="text-xs text-gray-400 mt-4 pt-4 border-t">Replies: ${t.replyCount || 0}</div>
    `;
    container.appendChild(card);
  });

  addPinsToMap(threadsForMap);
}

/* 6️⃣  Geo ------------------------------------------------------------- */
function getUserLocation() {
  if (!navigator.geolocation) return alert("Geolocation not supported");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      userLocation = { lat: coords.latitude, lng: coords.longitude };
      showMap(userLocation.lat, userLocation.lng);
      loadNearby();
    },
    (err) => alert("Could not get your location: " + err.message),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}
