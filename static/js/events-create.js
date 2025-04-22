document.addEventListener("DOMContentLoaded", () => {
    const firebaseConfig = {
      apiKey: "AIzaSyB2JqSDeOgNOdMHCfHqaC78Rgr-l7LqIkU",
      authDomain: "this-is-us-events.firebaseapp.com",
      projectId: "this-is-us-events",
      storageBucket: "this-is-us-events.firebasestorage.app",
      messagingSenderId: "215038360222",
      appId: "1:215038360222:web:98677c77158d282c9ad98f"
    };
  
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
  
    auth.onAuthStateChanged(user => {
      if (!user) {
        window.location.href = "/login?redirect=/events/create";
      } else {
        renderForm(user);
      }
    });
  
    function renderForm(user) {
      const container = document.getElementById("event-form-ui");
    
      container.innerHTML = `
        <div class="vh-100 w-100 flex items-center justify-center bg-washed-blue pa4">
          <div class="w-100 w-90-m w-80-l mw8 pa4 br3 shadow-1 bg-white">
            <h2 class="f3 fw6 tc mb4">Create an Event</h2>
    
            <form id="eventForm">
              <input type="text" id="title" placeholder="Event Title" class="input-reset ba b--black-20 pa2 mb3 w-100" required>
    
              <input type="datetime-local" id="datetime" class="input-reset ba b--black-20 pa2 mb3 w-100" required>
    
              <textarea id="description" placeholder="Event Description" class="input-reset ba b--black-20 pa2 mb3 w-100"></textarea>
    
              <div class="mb3">
                <input type="text" id="zipcode" placeholder="Enter ZIP Code" class="input-reset ba b--black-20 pa2 w-100 mb2">
                <button type="button" id="zoomToZip" class="f6 link dim br3 ph3 pv2 mb3 dib white bg-blue w-100">Zoom to ZIP</button>
              </div>
    
              <div id="map" class="br2 mb3" style="height: 300px;"></div>
    
              <input type="hidden" id="lat">
              <input type="hidden" id="lng">
    
              <button type="submit" class="f6 link dim br3 ph3 pv2 dib white bg-green w-100">Submit Event</button>
            </form>
          </div>
        </div>
      `;
    
      let map = L.map('map').setView([39.5, -98.35], 4); // Center USA
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
    
      // 📍 ZIP Code Geocoding
      document.getElementById("zoomToZip").addEventListener("click", async () => {
        const zip = document.getElementById("zipcode").value;
        if (!zip) return alert("Enter a ZIP code");
    
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${zip}`;
    
        try {
          const res = await fetch(url);
          const data = await res.json();
          if (data.length === 0) return alert("ZIP not found");
    
          const { lat, lon } = data[0];
          const latNum = parseFloat(lat);
          const lonNum = parseFloat(lon);
    
          map.setView([latNum, lonNum], 14);
    
          if (marker) {
            marker.setLatLng([latNum, lonNum]);
          } else {
            marker = L.marker([latNum, lonNum]).addTo(map);
          }
    
          document.getElementById("lat").value = latNum;
          document.getElementById("lng").value = lonNum;
    
        } catch (err) {
          alert("Error finding ZIP location: " + err.message);
        }
      });
    
      // 📝 Handle Submit
      document.getElementById("eventForm").addEventListener("submit", async (e) => {
        e.preventDefault();
    
        const title = document.getElementById("title").value;
        const datetime = document.getElementById("datetime").value;
        const description = document.getElementById("description").value;
        const lat = parseFloat(document.getElementById("lat").value);
        const lng = parseFloat(document.getElementById("lng").value);
    
        if (isNaN(lat) || isNaN(lng)) {
          return alert("Please select a location on the map or use the ZIP code finder.");
        }
    
        try {
          await db.collection("events").add({
            title,
            datetime,
            description,
            location: { lat, lng },
            createdBy: auth.currentUser.uid,
            createdAt: new Date()
          });
          alert("Event submitted!");
          window.location.href = "/events/discover";
        } catch (err) {
          alert("Error submitting event: " + err.message);
        }
      });
    }    
  });
  