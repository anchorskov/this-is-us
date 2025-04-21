// Include this script in your HTML after Firebase libraries are loaded (see below)

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyB2JqSDeOgNOdMHCfHqaC78Rgr-l7LqIkU",
    authDomain: "this-is-us-events.firebaseapp.com",
    projectId: "this-is-us-events",
    storageBucket: "this-is-us-events.firebasestorage.app",
    messagingSenderId: "215038360222",
    appId: "1:215038360222:web:98677c77158d282c9ad98f",
    measurementId: "G-DKHTH767TD"
  };
  
  // Init Firebase App
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  
  // Basic login handler
  function login() {
    const email = prompt("Enter your email:");
    const password = prompt("Enter your password:");
    auth.signInWithEmailAndPassword(email, password)
      .then(user => {
        document.getElementById("submit-form").style.display = "block";
      })
      .catch(error => {
        alert("Login failed: " + error.message);
      });
  }
  
  // Submit Event Handler
  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("eventForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = form.title.value;
        const datetime = form.datetime.value;
        const description = form.description.value;
  
        try {
          await db.collection("events").add({
            title,
            datetime,
            description
          });
          alert("Event submitted!");
          form.reset();
          loadEvents(); // Refresh the event list
        } catch (err) {
          alert("Error submitting event: " + err.message);
        }
      });
    }
  
    loadEvents();
  });
  
  // Load and display events
  async function loadEvents() {
    const container = document.getElementById("events-container");
    const snapshot = await db.collection("events").orderBy("datetime").get();
    container.innerHTML = "";
    snapshot.forEach(doc => {
      const e = doc.data();
      const div = document.createElement("div");
      div.innerHTML = `
        <h3>${e.title}</h3>
        <p><strong>Date:</strong> ${new Date(e.datetime).toLocaleString()}</p>
        <p>${e.description}</p>
        <hr/>
      `;
      container.appendChild(div);
    });
  }
  