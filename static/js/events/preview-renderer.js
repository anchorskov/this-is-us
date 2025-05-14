/**
 * Generate and display the event preview.
 * @param {Object} data  Event data with keys:
 *   title|name, datetime|date (ISO string), description, address|location,
 *   sponsor?, contactEmail?, contactPhone?, file (File)
 */
export function renderPreview(data) {
  const container = document.querySelector('#event-preview');
  if (!container) {
    console.error('❌ #event-preview container not found');
    return;
  }

  // 1) Normalize keys (support both old + new schemas)
  const title    = data.title    ?? data.name    ?? '';
  const rawDate  = data.datetime ?? data.date    ?? '';
  const address  = data.address  ?? data.location ?? '';
  const { description, sponsor, contactEmail, contactPhone, file } = data;

  // 2) Format date safely
  const formattedDate = rawDate
    ? new Date(rawDate).toLocaleString(undefined, { timeZoneName: 'short' })
    : '—';

  // 3) Blob URL for PDF preview
  const flyerURL = file ? URL.createObjectURL(file) : '';

  // 4) Build markup
  container.innerHTML = `
    <div class="bg-white pa4 br3 shadow-2">
      <h3 class="f3 mb3">🎯 Event Preview</h3>
      <ul class="list pl0 mb4">
        <li class="mb2"><strong>Title:</strong> ${title}</li>
        <li class="mb2"><strong>Date &amp; Time:</strong> ${formattedDate}</li>
        <li class="mb2"><strong>Description:</strong><br>${description}</li>
        <li class="mb2"><strong>Address:</strong> ${address}</li>
        ${sponsor      ? `<li class="mb2"><strong>Sponsor:</strong> ${sponsor}</li>` : ''}
        ${contactEmail ? `<li class="mb2"><strong>Email:</strong> ${contactEmail}</li>` : ''}
        ${contactPhone ? `<li class="mb2"><strong>Phone:</strong> ${contactPhone}</li>` : ''}
      </ul>
      ${flyerURL ? `
        <div class="mb4">
          <p class="mb2"><strong>Flyer Preview:</strong></p>
          <iframe
            class="br2"
            style="width:100%; height:300px; border:1px solid #bbb;"
            src="${flyerURL}">
          </iframe>
        </div>` : ''}
      <div class="flex justify-between">
        <button id="cancelPreview" class="f6 br2 ph3 pv2 bg-red white">✖ Cancel</button>
        <button id="confirmSubmit" class="f6 br2 ph3 pv2 bg-green white">✅ Confirm & Submit</button>
      </div>
    </div>
  `;

  // 5) Wire up buttons
  document
    .getElementById('cancelPreview')
    .addEventListener('click', () => {
      document.getElementById('eventForm').style.display = 'block';
      container.style.display = 'none';
    });

  // The actual submit click is still bound in event-form.js, so we don't need to rebind it here.

  // 6) Show preview
  container.style.display = 'block';
}
