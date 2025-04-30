// static/js/firebase-config.js

// 1) Your Firebase project configuration
window.firebaseConfig = {
  apiKey: "AIzaSyB2JqSDeOgNOdMHCfHqaC78Rgr-l7LqIkU",
  authDomain: "this-is-us-events.firebaseapp.com",
  projectId: "this-is-us-events",
  storageBucket: "this-is-us-events.firebasestorage.app",
  messagingSenderId: "215038360222",
  appId: "1:215038360222:web:98677c77158d282c9ad98f",
  measurementId: "G-DKHTH767TD"
};

// 2) Initialize Firebase so `firebase.auth()` and FirebaseUI will work
firebase.initializeApp(window.firebaseConfig);
