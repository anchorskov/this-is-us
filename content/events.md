---
title: "Events"
---

<div id="auth-status"></div>

<script>
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

  auth.onAuthStateChanged(user => {
    const el = document.getElementById("auth-status");
    if (!el) return;

    if (user) {
      el.innerHTML = `
        <p>Hello, ${user.displayName || user.email}</p>
        <button id="logout-btn">Logout</button>
      `;
      document.getElementById("logout-btn").onclick = () => auth.signOut();
    } else {
      el.innerHTML = `
        <button id="google-login-btn">Sign in with Google</button>
      `;
      document.getElementById("google-login-btn").onclick = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(e => alert(e.message));
      };
    }
  });
</script>
