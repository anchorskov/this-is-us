// 🔥 Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyB2JqSDeOgNOdMHCfHqaC78Rgr-l7LqIkU",
    authDomain: "this-is-us-events.firebaseapp.com",
    projectId: "this-is-us-events",
    storageBucket: "this-is-us-events.firebasestorage.app",
    messagingSenderId: "215038360222",
    appId: "1:215038360222:web:98677c77158d282c9ad98f",
    measurementId: "G-DKHTH767TD"
  };
  
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  
  // 📣 Auth UI logic
  auth.onAuthStateChanged(user => {
    const authStatus = document.getElementById("auth-status");
    const formSection = document.getElementById("submit-form");
  
    if (!authStatus || !formSection) return;
  
    if (user) {
      authStatus.innerHTML = `
        <p>Welcome, ${user.displayName || user.email}</p>
        <button id="logout-btn">Logout</button>
      `;
      formSection.style.display = "block";
      document.getElementById("logout-btn").onclick = () => auth.signOut();
    } else {
      authStatus.innerHTML = `
        <button id="google-login-btn" style="background:#4285F4;color:white;padding:10px 15px;border:none;border-radius:5px;">
          Sign in with Google
        </button>
      `;
      document.getElementById("google-login-btn").onclick = googleLogin;
      formSection.style.display = "none";
    }
  });
  
  function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => {
      alert("Login failed: " + err.message);
    });
  }
  
  // 📝 Form submission
  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("eventForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = form.title.value;
        const datetime = form.datetime.value;
        const description = form.description.value;
  
        try {
          await db.collection("events").add({ title, datetime, description });
          alert("Event submitted!");
          form.reset();
          loadEvents();
        } catch (err) {
          alert("Error submitting event: " + err.message);
        }
      });
    }
  
    loadEvents();
  });
  
  // 📅 Load events from Firestore
  async function loadEvents() {
    const container = document.getElementById("events-container");
    if (!container) return;
  
    try {
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
    } catch (err) {
      container.innerHTML = "<p>Failed to load events.</p>";
    }
  }
  