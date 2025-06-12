/* ---------------------------------------------------------
   Town-Hall “Home” controller (landing page)
   --------------------------------------------------------- */

console.log("🧠 townhall/home.js loaded");

let db;            // Firestore instance
let userLocation;  // { lat, lng }

/* 1️⃣  FIREBASE READY ---------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase === "undefined") return console.error("❌ Firebase missing");
  db = firebase.firestore();

  firebase.auth().onAuthStateChanged((u) => {
    window.currentUser = u || null;
    initUI();
  });
});

/* 2️⃣  UI BOOT ----------------------------------------------------------- */
function initUI() {
  attachTabs();
  attachFAB();
  attachLocationControls();
  loadTrending();       // initial fill while we wait for geolocation
}

/* --- Tabs -------------------------------------------------------------- */
function attachTabs() {
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      // switch button styles
      document.querySelectorAll("[data-tab]").forEach((b) =>
        b.classList.toggle("tab-active", b === btn)
      );
      // switch panels
      document
        .querySelectorAll(".thread-list")
        .forEach((p) => (p.style.display = "none"));
      document.getElementById(`tab-${tab}`).style.display = "grid";

      // lazy-load content
      if (tab === "nearby" && !userLocation) getUserLocation();
      if (tab === "mine") loadMine();
    });
  });
}

/* --- Floating “+” ------------------------------------------------------ */
function attachFAB() {
  const fab = document.getElementById("fab-new");
  fab?.addEventListener("click", () => (location.href = "/townhall/create/"));
}

/* --- Location input / mini-map ---------------------------------------- */
function attachLocationControls() {
  const input = document.getElementById("location-input");
  const btn   = document.getElementById("use-my-location");
  const mapEl = document.getElementById("mini-map");
  let map;

  input?.addEventListener("change", () => geocode(input.value));
  btn?.addEventListener("click", getUserLocation);

  function showMap(lat, lng) {
    mapEl.classList.remove("hidden");
    if (!map) {
      map = L.map("mini-map").setView([lat, lng], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
    } else {
      map.setView([lat, lng], 11);
    }
    L.marker([lat, lng]).addTo(map);
  }

  async function geocode(q) {
    // super-simple Nominatim call (no key required)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`;
    const res = await fetch(url).then((r) => r.json());
    if (res?.length) {
      const { lat, lon } = res[0];
      userLocation = { lat: +lat, lng: +lon };
      showMap(userLocation.lat, userLocation.lng);
      loadNearby();
    } else {
      alert("Location not found");
    }
  }
}

/* 3️⃣  LOADERS ---------------------------------------------------------- */
async function loadTrending() {
  const wrap = document.getElementById("tab-trending");
  wrap.innerHTML = "Loading…";
  const snap = await db
    .collection("townhall_threads")
    .orderBy("replyCount", "desc")
    .limit(10)
    .get();
  renderThreads(snap, wrap);
}

async function loadNearby() {
  if (!userLocation) return;
  const wrap = document.getElementById("tab-nearby");
  wrap.innerHTML = "Loading…";
  // naive radius query using geohash bounds (replace with geofire if needed)
  const snap = await db
    .collection("townhall_threads")
    .orderBy("timestamp", "desc")
    .limit(30)
    .get();
  renderThreads(snap, wrap, true);
}

async function loadMine() {
  if (!window.currentUser) return alert("Sign in first");
  const wrap = document.getElementById("tab-mine");
  wrap.innerHTML = "Loading…";
  const snap = await db
    .collection("townhall_threads")
    .where("authorUid", "==", window.currentUser.uid)
    .orderBy("timestamp", "desc")
    .get();
  renderThreads(snap, wrap);
}

/* 4️⃣  RENDER ----------------------------------------------------------- */
function renderThreads(snap, container, useDistance = false) {
  if (snap.empty) {
    container.innerHTML = "<p>No threads here.</p>";
    return;
  }
  container.innerHTML = "";

  snap.forEach((doc) => {
    const t = doc.data();
    const card = document.createElement("a");

    // 1. URI-encode the Firestore ID
    const safeId = encodeURIComponent(doc.id);

    // 2. Build a full absolute link to your dynamic thread page
    card.href = `${window.location.origin}/townhall/thread/?id=${safeId}`;

    // 3. Debug output
    console.log("🧩 rendering card for:", doc.id, t.title);
    console.log("🔗 card.href =", card.href);

    // 4. Render the card
    card.className =
      "block border rounded p-4 bg-white shadow hover:ring-2 hover:ring-blue-500 transition";
    card.innerHTML = `
      <h3 class="font-semibold mb-1">${t.title}</h3>
      <p class="text-sm text-gray-600 mb-2">${t.location || "Unknown"}</p>
      <p class="text-gray-700 text-sm">${(t.body || "").slice(0, 120)}…</p>
    `;
    container.appendChild(card);
  });
}

/* 5️⃣  GEO -------------------------------------------------------------- */
function getUserLocation() {
  if (!navigator.geolocation) return alert("Geolocation not supported");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      userLocation = { lat: coords.latitude, lng: coords.longitude };
      loadNearby();
    },
    (err) => alert("Location error: " + err.message),
    { enableHighAccuracy: true, timeout: 10_000 }
  );
}
