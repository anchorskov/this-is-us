---
title: "Events"
layout: "events"
---

## Upcoming Events

<div id="events-container">
  <p>Loading live events...</p>
</div>

---

## Want to Host an Event?
<button onclick="login()">Login to Submit an Event</button>

<div id="submit-form" style="display: none;">
  <form id="eventForm">
    <input type="text" placeholder="Event Title" name="title" required />
    <input type="datetime-local" name="datetime" required />
    <textarea placeholder="Event Description" name="description"></textarea>
    <button type="submit">Submit</button>
  </form>
</div>

<!-- Firebase Core -->
<script src="https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js"></script>

<!-- Your JS -->
<script src="/js/events.js"></script>
