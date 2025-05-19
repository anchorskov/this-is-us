// static/js/events/index.js

import { renderForm } from './event-form.js';

/**
 * Initialize the Event Creation Flow once DOM is ready and Firebase auth is available.
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('⚙️ Initializing Event Creation Flow');

  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.warn('Firebase auth not initialized; cannot render event form.');
    return;
  }

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      renderForm({ uid: user.uid });
    } else {
      console.warn('User not authenticated; event form will not render.');
    }
  });
});
