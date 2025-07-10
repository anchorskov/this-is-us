console.log("🔥 Firebase config loading (v9)…");

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyB2JqSDeOgNOdMHCfHqaC78Rgr-l7LqIkU",
  authDomain: "this-is-us-events.firebaseapp.com",
  projectId: "this-is-us-events",
  storageBucket: "this-is-us-events.appspot.com",
  messagingSenderId: "215038360222",
  appId: "1:215038360222:web:98677c77158d282c9ad98f",
  measurementId: "G-DKHTH767TD"
};

// register the default app once
if (!getApps().length) {
  initializeApp(firebaseConfig);
  console.log("✅ Firebase initialized (v9 module)");
}
