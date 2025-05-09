// Refactored version of events-create.js with function ordering corrected and bindAddressSearch added
// Future step: This could be modularized further into separate files (e.g., map.js, auth.js, form.js)

import { createZipSearchBox } from './leafletzipsearch.js';

console.log("🔥 events-create.js loaded");

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

document.addEventListener("DOMContentLoaded", () => {
  initFirebaseAuth();
});

function initFirebaseAuth() {
  auth.onAuthStateChanged(user => handleAuthState(user));
}

function handleAuthState(user) {
  const loginPrompt = $("#login-prompt");
  const authContainer = $("#firebaseui-auth-container");
  const formContainer = $("#event-form");

  if (user && (user.emailVerified || user.phoneNumber)) {
    loginPrompt.style.display = "none";
    authContainer.style.display = "none";
    if (formContainer) renderForm(user);
  } else {
    loginPrompt.style.display = "block";
    authContainer.style.display = "block";
    if (!window.__handledLoginUI) waitForFirebaseUI();
  }
}

function waitForFirebaseUI() {
  if (window.ui && window.uiConfig) {
    console.log("⚙️ Starting FirebaseUI");
    window.__handledLoginUI = true;
    window.ui.start("#firebaseui-auth-container", window.uiConfig);
  } else {
    console.log("⏳ Waiting for FirebaseUI...");
    setTimeout(waitForFirebaseUI, 200);
  }
}

function $(selector) {
  return document.querySelector(selector);
}

function initMap() {
  const map = L.map('map').setView([39.5, -98.35], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  const markerGroup = L.layerGroup().addTo(map);
  window._leafletMap = map;
  window._markerGroup = markerGroup;

  function setMarker(lat, lng) {
    $("#lat").value = lat;
    $("#lng").value = lng;
    markerGroup.clearLayers();
    L.marker([lat, lng]).addTo(markerGroup);
    map.setView([lat, lng], 14);
    $("#locationConfirmation").textContent = `📍 Location set: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  map.on('click', e => setMarker(e.latlng.lat, e.latlng.lng));
  createZipSearchBox(map, setMarker);

  return { map, setMarker };
}

function bindAddressSearch(setMarker) {
  const searchBtn = $("#searchAddress");
  const addressInput = $("#address");

  if (!searchBtn || !addressInput) return;

  searchBtn.addEventListener("click", async () => {
    const address = addressInput.value.trim();
    if (!address) return alert("Please enter an address.");

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await res.json();

      if (!data.length) return alert("Location not found.");

      const { lat, lon } = data[0];
      setMarker(parseFloat(lat), parseFloat(lon));
    } catch (err) {
      console.error("Address lookup failed:", err);
      alert("Location lookup failed: " + err.message);
    }
  });
}

function renderForm(user) {
  const container = $("#event-form");
  if (!container) return;

  container.innerHTML = renderFormHTML();

  const successBox = $("#success-message");
  if (successBox) successBox.style.display = "none";

  const { map, setMarker } = initMap();
  bindAddressSearch(setMarker);
  bindPdfPreview();
  bindFormSubmit(user);
}

function renderFormHTML() {
  return `
    <div class="w-100 flex items-center justify-center pa5" style="background-color: #f7f7f7;">
      <div class="w-100 w-90-m w-80-l mw6 pa4 br3 shadow-1 bg-white">
        <h2 class="f3 fw6 tc mb4">Create an Event</h2>
        <form id="eventForm" class="flex flex-column">
          <label for="title" class="db mb2 fw6">Event Title</label>
          <input type="text" id="title" class="input-reset ba b--black-20 pa2 mb3 w-100" required>

          <label for="datetime" class="db mb2 fw6">Event Date & Time</label>
          <input type="datetime-local" id="datetime" class="input-reset ba b--black-20 pa2 mb3 w-100" required>

          <label for="description" class="db mb2 fw6">Description</label>
          <textarea id="description" class="input-reset ba b--black-20 pa2 mb3 w-100" rows="4" required></textarea>

          <label for="address" class="db mb2 fw6">Event Address or ZIP Code</label>
          <input type="text" id="address" class="input-reset ba b--black-20 pa2 w-100 mb2" placeholder="e.g., 123 Main St, City, State or ZIP">

          <button type="button" id="searchAddress" class="f6 link dim br2 ph3 pv2 mb3 dib white bg-dark-blue w-100">🔍 Search Address</button>

          <label for="sponsor" class="db mb2 fw6">Sponsoring Organization (optional)</label>
          <input type="text" id="sponsor" class="input-reset ba b--black-20 pa2 mb3 w-100">

          <label for="contactEmail" class="db mb2 fw6">Contact Email (optional)</label>
          <input type="email" id="contactEmail" class="input-reset ba b--black-20 pa2 mb3 w-100">

          <label for="contactPhone" class="db mb2 fw6">Contact Phone (optional)</label>
          <input type="tel" id="contactPhone" class="input-reset ba b--black-20 pa2 mb3 w-100">

          <div id="map" class="br2 mb2" style="height: 300px; border: 1px solid #ccc;"></div>
          <p id="locationConfirmation" class="mt2 f6 dark-gray"></p>

          <label for="eventPdf" class="db mb2 fw6">Attach PDF Flyer</label>
          <input type="file" id="eventPdf" accept="application/pdf" class="input-reset ba b--black-20 pa2 mb3 w-100">
          <iframe id="pdfPreview" style="width:100%; height:300px; border:1px solid #ddd; display:none;" class="mb3"></iframe>

          <input type="hidden" id="lat"><input type="hidden" id="lng">

          <button type="submit" class="f5 link dim br3 ph3 pv3 mb2 dib white bg-green w-100">📤 Submit Event</button>
        </form>

        <div id="success-message" class="dn tc bg-washed-green dark-green pa3 br3 mt3">✅ Event submitted successfully!</div>
      </div>
    </div>`;
}

function $(selector) {
  return document.querySelector(selector);
}
function initMap() {
  const map = L.map('map').setView([39.5, -98.35], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  const markerGroup = L.layerGroup().addTo(map);
  window._leafletMap = map;
  window._markerGroup = markerGroup;

  let marker;

  function setMarker(lat, lng) {
    $("#lat").value = lat;
    $("#lng").value = lng;
    markerGroup.clearLayers();
    marker = L.marker([lat, lng]).addTo(markerGroup);
    map.setView([lat, lng], 14);
    $("#locationConfirmation").textContent = `📍 Location set: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  map.on('click', e => setMarker(e.latlng.lat, e.latlng.lng));

  createZipSearchBox(map, setMarker);

  return { map, setMarker };
}

function bindFormSubmit(user) {
  $("#eventForm").addEventListener("submit", async e => {
    e.preventDefault();

    const title = $("#title").value.trim();
    const datetime = $("#datetime").value;
    const description = $("#description").value.trim();
    const address = $("#address").value.trim();
    const lat = $("#lat").value;
    const lng = $("#lng").value;
    const file = $("#eventPdf").files[0];
    const sponsor = $("#sponsor")?.value?.trim() || "";
    const email = $("#contactEmail")?.value?.trim() || "";
    const phone = $("#contactPhone")?.value?.trim() || "";

    const now = new Date();
    const eventDate = new Date(datetime);

    if (!title || !datetime || !description || !lat || !lng || !file) {
      return alert("📌 Please complete all required fields:\n- Title\n- Date & Time\n- Description\n- Map location\n- PDF attachment");
    }

    if (eventDate < now) {
      return alert("📅 Please select a future date and time for the event.");
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return alert("📧 Please enter a valid email address.");
    }

    if (phone && !/^\+?[0-9\s\-\(\)]{7,}$/.test(phone)) {
      return alert("📞 Please enter a valid phone number.");
    }

    const formData = new FormData();
    formData.append("name", title);
    formData.append("date", datetime);
    formData.append("description", description);
    formData.append("location", address);
    formData.append("lat", lat);
    formData.append("lng", lng);
    formData.append("file", file);
    formData.append("userId", user.uid);
    formData.append("sponsor", sponsor);
    formData.append("contact_email", email);
    formData.append("contact_phone", phone);

    try {
      const submitButton = $("#eventForm button[type='submit']");
      submitButton.disabled = true;
      submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting…`;

      const res = await fetch("/api/events/create", {
        method: "POST",
        body: formData
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unknown error");

      $("#success-message").style.display = "block";
      $("#success-message").scrollIntoView({ behavior: "smooth" });

      setTimeout(() => {
        $("#success-message").style.display = "none";
      }, 6000);

      $("#pdfPreview").style.display = "none";
      $("#locationConfirmation").textContent = "";
      $("#eventForm").reset();
      $("#lat").value = "";
      $("#lng").value = "";

      if (window._leafletMap) {
        window._leafletMap.setView([39.5, -98.35], 4); // reset map view
        if (window._markerGroup) window._markerGroup.clearLayers();
      }

      submitButton.disabled = false;
      submitButton.innerHTML = "📤 Submit Event";

    } catch (err) {
      const submitButton = $("#eventForm button[type='submit']");
      submitButton.disabled = false;
      submitButton.innerHTML = "📤 Submit Event";

      console.error("Event submit failed:", err);
      alert("Error: " + err.message);
    }
  });
}

