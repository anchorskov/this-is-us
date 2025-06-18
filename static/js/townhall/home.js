/* ---------------------------------------------------------
    File: /static/js/townhall/home.js
    Description: Main controller for the /townhall/ landing page.
                 This version includes a fix for the Leaflet race condition.
    Dependencies:
      - Firebase v8.10.1
      - Leaflet.js v1.9.4
      - /js/utils/show-sign-in.js
   --------------------------------------------------------- */
import { showSignInGate } from '../utils/show-sign-in.js';

console.log("🧠 townhall/home.js loaded");

let db;
let userLocation;
let map;
// Declare the variable but don't initialize it here.
let threadMarkers;

/* 1️⃣  FIREBASE READY ---------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    const waitForFirebase = setInterval(() => {
        if (typeof firebase !== "undefined" && firebase.auth) {
            clearInterval(waitForFirebase);
            console.log("✅ Firebase is ready.");
            db = firebase.firestore();
            firebase.auth().onAuthStateChanged((u) => {
                console.log("🔄 Auth state changed:", u ? u.email : "Not signed in");
                window.currentUser = u || null;
                initUI();
            });
        }
    }, 100);
});

/* 2️⃣  UI BOOT ----------------------------------------------------------- */
function initUI() {
    attachTabs();
    attachLocationControls();
    loadTrending();
}

/* --- Tabs -------------------------------------------------------------- */
function attachTabs() {
    document.querySelectorAll("[data-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll("[data-tab]").forEach((b) => {
                const isClicked = b === btn;
                b.classList.toggle("border-blue-600", isClicked);
                b.classList.toggle("text-blue-600", isClicked);
                b.classList.toggle("border-transparent", !isClicked);
                b.classList.toggle("text-gray-500", !isClicked);
            });
            document.querySelectorAll(".thread-list").forEach((p) => p.classList.add("hidden"));
            document.getElementById(`tab-${tab}`).classList.remove("hidden");

            if (tab === "nearby" && !userLocation) getUserLocation();
            if (tab === "mine" && !btn.dataset.loaded) {
                loadMine();
                btn.dataset.loaded = "true";
            }
        });
    });
}

/* --- Location input / mini-map ---------------------------------------- */
function attachLocationControls() {
    const input = document.getElementById("location-input");
    const btn = document.getElementById("use-my-location");

    input?.addEventListener("input", () => {
        if (input.value.length === 5) {
            geocode(input.value);
        }
    });
    input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") geocode(input.value);
    });
    btn?.addEventListener("click", getUserLocation);
}

// UPDATED: This function now tells the map to redraw itself.
function showMap(lat, lng) {
    const mapEl = document.getElementById("mini-map");
    mapEl.classList.remove("hidden");

    if (typeof L === 'undefined') {
        console.log("⏳ Leaflet not ready yet, waiting...");
        setTimeout(() => showMap(lat, lng), 100);
        return;
    }

    console.log("🗺️ Leaflet is ready, initializing map.");
    if (!map) {
        threadMarkers = L.layerGroup();
        map = L.map("mini-map").setView([lat, lng], 11);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        threadMarkers.addTo(map);
    } else {
        map.setView([lat, lng], 11);
    }
    L.marker([lat, lng]).addTo(map);
    
    // THIS IS THE FIX: Tell Leaflet to re-check its container size and redraw.
    // We wrap it in a short timeout to ensure the DOM has updated.
    setTimeout(() => {
        map.invalidateSize();
    }, 10);
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
    } catch (error) {
        console.error("Geocoding API error:", error);
    }
}

/* 3️⃣  LOADERS ---------------------------------------------------------- */
async function loadTrending() {
    const container = document.getElementById("tab-trending");
    if (!db) return;
    container.innerHTML = "<p class='text-gray-500'>Loading trending threads...</p>";
    try {
        const snap = await db.collection("townhall_threads").orderBy("replyCount", "desc").limit(10).get();
        renderThreads(snap, container);
    } catch (e) {
        console.error("Firestore Error (Trending):", e);
        container.innerHTML = `<p class='text-red-500'>Error loading threads. You may need to create a Firestore index.</p>`;
    }
}

async function loadNearby() {
    if (!userLocation) return;
    const container = document.getElementById("tab-nearby");
    if (!db) return;
    container.innerHTML = "<p class='text-gray-500'>Finding threads near you...</p>";
    try {
        const snap = await db.collection("townhall_threads").orderBy("timestamp", "desc").limit(30).get();
        renderThreads(snap, container);
    } catch (e) {
        console.error("Firestore Error (Nearby):", e);
    }
}

async function loadMine() {
    const container = document.getElementById("tab-mine");
    if (!window.currentUser) {
        return showSignInGate({
            container: container,
            message: "Sign in to see the threads you've started."
        });
    }
    if (!db) return;
    container.innerHTML = "<p class='text-gray-500'>Loading your threads...</p>";
    try {
        const snap = await db.collection("townhall_threads").where("authorUid", "==", window.currentUser.uid).get();
        renderThreads(snap, container);
    } catch (e) {
        console.error("Firestore Error (Mine):", e);
    }
}

/* 4️⃣  RENDER & MAP PINS ------------------------------------------------- */
function addPinsToMap(threads) {
    if (!map) return;
    threadMarkers.clearLayers();

    threads.forEach(thread => {
        if (thread.lat && thread.lng) {
            const marker = L.marker([thread.lat, thread.lng]);
            const popupContent = `
                <a href="/townhall/thread/?id=${encodeURIComponent(thread.id)}" class="font-bold text-blue-600 hover:underline">
                    ${thread.title || 'View Thread'}
                </a>`;
            marker.bindPopup(popupContent);
            threadMarkers.addLayer(marker);
        }
    });
}

function renderThreads(snap, container) {
    if (snap.empty) {
        container.innerHTML = "<p class='text-gray-600 col-span-full text-center py-10'>No threads found.</p>";
        return;
    }
    container.innerHTML = "";
    
    const threadsForMap = [];
    snap.forEach((doc) => {
        const t = doc.data();
        threadsForMap.push({ id: doc.id, ...t });

        const card = document.createElement("div");
        card.className = "bg-white shadow-lg rounded-xl p-6 border border-gray-200 flex flex-col hover:shadow-xl transition-shadow duration-300";
        card.innerHTML = `
            <a href="/townhall/thread/?id=${encodeURIComponent(doc.id)}" class="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors">${t.title || "Untitled Thread"}</a>
            <p class="text-sm text-gray-500 mt-1 mb-3">${t.location || "General"}</p>
            <p class="text-gray-700 text-sm flex-grow">${(t.body || "").slice(0, 120)}…</p>
            <div class="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">Replies: ${t.replyCount || 0}</div>
        `;
        container.appendChild(card);
    });

    addPinsToMap(threadsForMap);
}


/* 5️⃣  GEO -------------------------------------------------------------- */
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
