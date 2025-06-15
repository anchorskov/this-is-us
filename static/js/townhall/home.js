/* ---------------------------------------------------------
    File: /static/js/townhall/home.js
    Description: Main controller for the /townhall/ landing page.
    Dependencies:
      - Firebase v8.10.1
      - Leaflet.js v1.9.4
      - /js/utils/show-sign-in.js
   --------------------------------------------------------- */
import { showSignInGate } from '../utils/show-sign-in.js';

console.log("🧠 townhall/home.js loaded");

let db;           // Firestore instance
let userLocation; // { lat, lng }
let map;          // Leaflet map instance

/* 1️⃣  FIREBASE READY ---------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    // This function will wait for Firebase to be ready before initializing the UI.
    const waitForFirebase = setInterval(() => {
        if (typeof firebase !== "undefined" && firebase.auth) {
            clearInterval(waitForFirebase); // Stop checking
            console.log("✅ Firebase is ready.");
            
            // Initialize Firestore instance safely
            db = firebase.firestore();

            firebase.auth().onAuthStateChanged((u) => {
                console.log("🔄 Auth state changed:", u ? u.email : "Not signed in");
                window.currentUser = u || null;
                initUI();
            });
        }
    }, 100); // Check every 100ms
});


/* 2️⃣  UI BOOT ----------------------------------------------------------- */
function initUI() {
    attachTabs();
    // The Floating Action Button has been removed, so we no longer call attachFAB().
    attachLocationControls();
    // Load trending topics by default
    loadTrending();
}

/* --- Tabs -------------------------------------------------------------- */
function attachTabs() {
    document.querySelectorAll("[data-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;
            // Update button styles
            document.querySelectorAll("[data-tab]").forEach((b) => {
                const isClicked = b === btn;
                b.classList.toggle("border-blue-600", isClicked);
                b.classList.toggle("text-blue-600", isClicked);
                b.classList.toggle("border-transparent", !isClicked);
                b.classList.toggle("text-gray-500", !isClicked);
            });
            // Show the correct panel
            document.querySelectorAll(".thread-list").forEach((p) => {
                 p.classList.add("hidden")
            });
            document.getElementById(`tab-${tab}`).classList.remove("hidden");

            // Lazy-load content
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

    // UPDATED: This now triggers the search automatically when 5 digits are entered.
    input?.addEventListener("input", () => {
        if (input.value.length === 5) {
            geocode(input.value);
        }
    });

    // We keep the 'Enter' key functionality as a fallback for users who prefer it.
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        geocode(input.value);
      }
    });

    btn?.addEventListener("click", getUserLocation);
}

function showMap(lat, lng) {
    const mapEl = document.getElementById("mini-map");
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
        alert("Could not fetch location data.");
    }
}


/* 3️⃣  LOADERS ---------------------------------------------------------- */
async function loadTrending() {
    const container = document.getElementById("tab-trending");
    if (!db) return container.innerHTML = "<p class='text-red-500'>Error: Database not initialized.</p>";
    container.innerHTML = "<p class='text-gray-500'>Loading trending threads...</p>";
    try {
        console.log("Firestore: Querying 'townhall_threads' ordered by replyCount...");
        const snap = await db
            .collection("townhall_threads")
            .orderBy("replyCount", "desc")
            .limit(10)
            .get();
        console.log(`Firestore: Found ${snap.size} trending documents.`);
        renderThreads(snap, container);
    } catch (error) {
        console.error("Firestore Error (Trending):", error);
        container.innerHTML = `<p class='text-red-500'>Error loading threads. You may need to create a Firestore index.</p>`;
    }
}

async function loadNearby() {
    if (!userLocation) return;
    const container = document.getElementById("tab-nearby");
    if (!db) return container.innerHTML = "<p class='text-red-500'>Error: Database not initialized.</p>";
    container.innerHTML = "<p class='text-gray-500'>Finding threads near you...</p>";
    try {
        console.log("Firestore: Querying 'townhall_threads' for nearby...");
        const snap = await db
            .collection("townhall_threads")
            .orderBy("timestamp", "desc")
            .limit(30)
            .get();
        console.log(`Firestore: Found ${snap.size} nearby documents.`);
        renderThreads(snap, container);
    } catch (error) {
        console.error("Firestore Error (Nearby):", error);
        container.innerHTML = `<p class='text-red-500'>Error loading threads. Check the console.</p>`;
    }
}

async function loadMine() {
    const container = document.getElementById("tab-mine");
    if (!window.currentUser) {
        // UPDATED: Use the new, more user-friendly sign-in gate.
        return showSignInGate({ 
            container: container,
            message: "Sign in to see the threads you've started."
        });
    }
    
    if (!db) return container.innerHTML = "<p class='text-red-500'>Error: Database not initialized.</p>";
    container.innerHTML = "<p class='text-gray-500'>Loading your threads...</p>";
    try {
        console.log("Firestore: Querying 'townhall_threads' for current user...");
        const snap = await db
            .collection("townhall_threads")
            .where("authorUid", "==", window.currentUser.uid)
            .get();

        console.log(`Firestore: Found ${snap.size} user documents.`);
        renderThreads(snap, container);
    } catch (error) {
        console.error("Firestore Error (Mine):", error);
        container.innerHTML = `<p class='text-red-500'>Could not load your threads at this time.</p>`;
    }
}

/* 4️⃣  RENDER ----------------------------------------------------------- */
function renderThreads(snap, container) {
    if (snap.empty) {
        container.innerHTML = "<p class='text-gray-600 col-span-full text-center py-10'>No threads found.</p>";
        return;
    }
    container.innerHTML = "";

    snap.forEach((doc) => {
        const t = doc.data();
        const card = document.createElement("div");
        card.className = "bg-white shadow-lg rounded-xl p-6 border border-gray-200 flex flex-col hover:shadow-xl transition-shadow duration-300";

        const titleLink = document.createElement("a");
        titleLink.href = `/townhall/thread/?id=${encodeURIComponent(doc.id)}`;
        titleLink.className = "text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors";
        titleLink.textContent = t.title || "Untitled Thread";

        const locationText = document.createElement("p");
        locationText.className = "text-sm text-gray-500 mt-1 mb-3";
        locationText.textContent = t.location || "General";

        const bodyText = document.createElement("p");
        bodyText.className = "text-gray-700 text-sm flex-grow";
        bodyText.textContent = (t.body || "").slice(0, 120) + '…';

        const footer = document.createElement('div');
        footer.className = "text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100";
        footer.textContent = `Replies: ${t.replyCount || 0}`;

        card.appendChild(titleLink);
        card.appendChild(locationText);
        card.appendChild(bodyText);
        card.appendChild(footer);

        container.appendChild(card);
    });
}

/* 5️⃣  GEO -------------------------------------------------------------- */
function getUserLocation() {
    if (!navigator.geolocation) return alert("Geolocation is not supported by your browser.");
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
