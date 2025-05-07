// events-create.js
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
// Firestore and Auth
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(user => {
    if (!user || !user.emailVerified) {
      window.location.href = "/login?redirect=/events/create";
    } else {
      renderForm(user);
    }
  });
});

function renderForm(user) {
  const container = document.getElementById("event-form-ui");
  container.innerHTML = `
    <div class="vh-100 w-100 flex items-center justify-center bg-lightest-blue pa4">
      <div class="w-100 w-90-m w-80-l mw7 pa4 br3 shadow-1 bg-white">
        <h2 class="f3 fw6 tc mb4">Create an Event</h2>
        <form id="eventForm">
          <input type="text" id="title" placeholder="Event Title" class="input-reset ba b--black-20 pa2 mb3 w-100" required>

          <input type="datetime-local" id="datetime" class="input-reset ba b--black-20 pa2 mb3 w-100" required>

          <textarea id="description" placeholder="Event Description" class="input-reset ba b--black-20 pa2 mb3 w-100" required></textarea>

          <div class="mb3">
            <input type="text" id="zipcode" placeholder="Enter ZIP Code" class="input-reset ba b--black-20 pa2 w-100 mb2">
            <button type="button" id="zoomToZip" class="f6 link dim br3 ph3 pv2 mb3 dib white bg-blue w-100">Zoom to ZIP</button>
          </div>

          <div id="map" class="br2 mb3" style="height: 300px;"></div>

          <input type="file" id="eventPdf" accept="application/pdf" class="mb3">

          <input type="hidden" id="lat">
          <input type="hidden" id="lng">

          <button type="submit" class="f6 link dim br3 ph3 pv2 dib white bg-green w-100">Submit Event</button>
        </form>
      </div>
    </div>
  `;

  // Setup map
  let map = L.map('map').setView([39.5, -98.35], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  let marker;

  map.on('click', function (e) {
    if (marker) {
      marker.setLatLng(e.latlng);
    } else {
      marker = L.marker(e.latlng).addTo(map);
    }
    document.getElementById("lat").value = e.latlng.lat;
    document.getElementById("lng").value = e.latlng.lng;
  });

  // ZIP lookup
  document.getElementById("zoomToZip").addEventListener("click", async () => {
    const zip = document.getElementById("zipcode").value.trim();
    if (!zip) return alert("Enter a ZIP code");
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${zip}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.length === 0) return alert("ZIP not found");
      const { lat, lon } = data[0];
      const coords = [parseFloat(lat), parseFloat(lon)];
      map.setView(coords, 14);
      if (!marker) marker = L.marker(coords).addTo(map);
      else marker.setLatLng(coords);
      document.getElementById("lat").value = coords[0];
      document.getElementById("lng").value = coords[1];
    } catch (err) {
      alert("Error finding ZIP: " + err.message);
    }
  });

  // Submit logic
  document.getElementById("eventForm").addEventListener("submit", async (e) => {
    e.preventDefault();
  
    const title = document.getElementById("title").value;
    const datetime = document.getElementById("datetime").value;
    const description = document.getElementById("description").value;
    const lat = document.getElementById("lat").value;
    const lng = document.getElementById("lng").value;
    const file = document.getElementById("eventPdf").files[0];
  
    if (!title || !datetime || !description || !lat || !lng || !file) {
      return alert("All fields including a PDF and map location are required.");
    }
  
    if (file.type !== "application/pdf" || file.size > 5 * 1024 * 1024) {
      return alert("Only PDF files under 5MB allowed.");
    }
  
    const formData = new FormData();
    formData.append("name", title);
    formData.append("date", datetime);
    formData.append("location", `${lat},${lng}`);
    formData.append("file", file);
  
    try {
      const res = await fetch("/api/events/create", {
        method: "POST",
        body: formData
      });
  
      const result = await res.json();
  
      if (!res.ok) throw new Error(result.error || "Unknown error");
  
      alert("✅ Event submitted successfully!");
      window.location.href = "/events/hub/";
  
    } catch (err) {
      console.error("Event submit failed:", err);
      alert("Error: " + err.message);
    }
  });
  
}
