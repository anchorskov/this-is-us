// static/js/townhall/thread/firebase-init.js

export let db = null;
export let currentUser = null;

export function initFirebase() {
  if (!window.firebase || !firebase.firestore || !firebase.auth) {
    throw new Error("Firebase SDKs not loaded properly.");
  }
  db = firebase.firestore();
}

export function onAuthChange(callback) {
  firebase.auth().onAuthStateChanged(user => {
    currentUser = user;
    callback(user);
  });
}
