// index.js — Master orchestrator for the Event Create page

import { initFirebaseAuth } from '../firebase-auth.js'; // global setup only if not already run
import { renderForm } from './event-form.js';

console.log("⚙️ Initializing Event Creation Flow");

document.addEventListener("DOMContentLoaded", () => {
  initFirebaseAuth({
    onAuthSuccess: user => {
      if (!user) return;
      renderForm(user);
    }
  });
});
