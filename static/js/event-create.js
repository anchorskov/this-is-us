(() => {
    const root = document.getElementById('event-form');
    root.innerHTML = `
      <form id="createForm" enctype="multipart/form-data">
        <label>
          Name:<br><input name="name" required>
        </label><br>
        <label>
          Date:<br><input name="date" type="date" required>
        </label><br>
        <label>
          Location:<br><input name="location" required>
        </label><br>
        <label>
          PDF Flyer:<br><input name="file" type="file" accept="application/pdf" required>
        </label><br>
        <button type="submit">Create Event</button>
      </form>
      <div id="formMsg"></div>
    `;
  
    document.getElementById('createForm').addEventListener('submit', async e => {
      e.preventDefault();
      const msg = document.getElementById('formMsg');
      msg.textContent = 'Submitting…';
      const fd = new FormData(e.target);
  
      try {
        const r = await fetch('/api/events/create', {
          method: 'POST',
          credentials: 'include',
          body: fd
        });
        const j = await r.json();
        if (r.ok) {
          msg.textContent = 'Event created successfully!';
          e.target.reset();
        } else {
          msg.textContent = `Error: ${j.error||r.statusText}`;
        }
      } catch (err) {
        msg.textContent = 'Network error.';
        console.error(err);
      }
    });
  })();
  