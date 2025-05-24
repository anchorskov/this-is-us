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
    const container = document.getElementById('event-form');
    if (!container) return;

    if (user) {
      // Show the form: remove hidden, add flex-layout classes
      container.classList.remove('hidden');
      container.classList.add('flex', 'items-center', 'justify-center');
      console.log('🟢 User authenticated — showing form (hidden=false, flex added)');
      renderForm({ uid: user.uid });
    } else {
      // Hide the form: add hidden, remove flex-layout classes
      container.classList.add('hidden');
      container.classList.remove('flex', 'items-center', 'justify-center');
      console.log('🔒 User not authenticated — hiding form (hidden=true)');
    }
  });
});
