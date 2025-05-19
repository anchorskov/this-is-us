// static/js/events/preview-renderer.js

/** 
 * Generate and display the event preview.
 * @param {Object} data  Event data with keys: name, date, description, location, sponsor?, contact_email?, contact_phone?, file?
 */
export function renderPreview(data) {
  const container = document.querySelector('#event-preview');
  if (!container) {
    console.error('❌ #event-preview container not found');
    return;
  }

  console.log('🖼️ renderPreview called with data:', data);

  // Normalize keys
  const title       = data.name || '';
  const rawDate     = data.date || '';
  const address     = data.location || '';
  const description = data.description || '';
  const sponsor     = data.sponsor || '';
  const email       = data.contact_email || data.contactEmail || '';
  const phone       = data.contact_phone || data.contactPhone || '';
  const file        = data.file;

  // Format date
  const formattedDate = rawDate
    ? new Date(rawDate).toLocaleString(undefined, { timeZoneName: 'short' })
    : '—';

  // PDF URL
  const flyerURL = file ? URL.createObjectURL(file) : '';

  // Build markup
  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow p-6 space-y-4">
      <h3 class="text-lg font-semibold">🎯 Event Preview</h3>
      <dl class="grid grid-cols-1 gap-y-2">
        <div><dt class="font-semibold">Title:</dt><dd>${title}</dd></div>
        <div><dt class="font-semibold">Date &amp; Time:</dt><dd>${formattedDate}</dd></div>
        <div><dt class="font-semibold">Description:</dt><dd>${description}</dd></div>
        <div><dt class="font-semibold">Address:</dt><dd>${address}</dd></div>
        ${sponsor ? `<div><dt class="font-semibold">Sponsor:</dt><dd>${sponsor}</dd></div>` : ''}
        ${email   ? `<div><dt class="font-semibold">Email:</dt><dd>${email}</dd></div>` : ''}
        ${phone   ? `<div><dt class="font-semibold">Phone:</dt><dd>${phone}</dd></div>` : ''}
      </dl>
      ${flyerURL ? `
        <div>
          <p class="font-semibold mb-2">Flyer Preview:</p>
          <iframe src="${flyerURL}" class="w-full h-72 rounded border border-gray-300"></iframe>
        </div>` : ''}
      <div class="flex justify-between">
        <button id="cancelPreview" class="rounded-md px-4 py-2 bg-red-600 text-white">✖ Cancel</button>
        <button id="confirmSubmit" class="rounded-md px-4 py-2 bg-green-600 text-white">✅ Confirm & Submit</button>
      </div>
    </div>
  `;

  // Show the preview pane
  console.log('🖼️ Showing preview pane');
  container.hidden = false;
  container.classList.remove('hidden');

  // Hide the form
  const form = document.getElementById('eventForm');
  form.hidden = true;

  // Wire up Cancel
  const cancelBtn = document.getElementById('cancelPreview');
  cancelBtn.addEventListener('click', () => {
    console.log('🖼️ Cancel preview—showing form again');
    form.hidden = false;
    container.hidden = true;
  });
}
