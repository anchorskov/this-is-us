document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById('event-form');
  const authNotice = document.getElementById('auth-container');
  const msg = document.createElement('div');
  msg.id = 'formMsg';

  firebase.auth().onAuthStateChanged(user => {
    if (user && (user.emailVerified || user.phoneNumber)) {
      console.log("✅ Authenticated + verified, rendering event form");

      authNotice.style.display = 'none';
      root.innerHTML = `
        <form id="createForm" enctype="multipart/form-data">
          <label>Name:<br><input name="name" required></label><br>
          <label>Date:<br><input name="date" type="date" required></label><br>
          <label>Location:<br><input name="location" required></label><br>
          <label>PDF Flyer:<br><input name="file" type="file" accept="application/pdf" required></label><br>
          <button type="submit">Create Event</button>
        </form>
      `;
      root.appendChild(msg);

      document.getElementById('createForm').addEventListener('submit', async e => {
        e.preventDefault();
        msg.textContent = 'Submitting…';
        const fd = new FormData(e.target);

        try {
          const res = await fetch('/api/events/create', {
            method: 'POST',
            credentials: 'include', // optional, based on cookie use
            body: fd
          });

          const json = await res.json();
          if (res.ok) {
            msg.textContent = '✅ Event created successfully!';
            e.target.reset();
          } else {
            msg.textContent = `❌ Error: ${json.error || res.statusText}`;
          }
        } catch (err) {
          msg.textContent = '❌ Network error.';
          console.error(err);
        }
      });
    } else {
      console.warn("🔒 User not signed in or not verified — redirecting or prompting login");
      authNotice.style.display = 'block';
      root.innerHTML = '';
    }
  });
});
