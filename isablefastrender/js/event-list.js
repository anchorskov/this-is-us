(async () => {
    const listEl = document.getElementById('events-list');
    try {
      const resp = await fetch('/api/events');
      const events = await resp.json();
      if (!events.length) {
        listEl.innerHTML = '<p>No upcoming events.</p>';
        return;
      }
      const ul = document.createElement('ul');
      for (const ev of events) {
        const li = document.createElement('li');
        li.innerHTML = `
          <strong>${ev.name}</strong><br>
          ${new Date(ev.date).toLocaleDateString()} — ${ev.location}
          <a href="${ev.pdf_url}" target="_blank">[PDF]</a>
        `;
        ul.append(li);
      }
      listEl.innerHTML = '';
      listEl.append(ul);
    } catch (err) {
      listEl.innerHTML = `<p>Error loading events.</p>`;
      console.error(err);
    }
  })();
  