// static/js/events/preview-renderer.js

/**
 * Generate and display the event preview.
 * @param {Object} data  Event data with keys:
 *   title, datetime (ISO string), description, address,
 *   sponsor?, contactEmail?, contactPhone?, file (File)
 */
export function renderPreview(data) {
    const container = document.querySelector('#event-preview');
    if (!container) {
      console.error('❌ #event-preview container not found');
      return;
    }
  
    // Format date with timezone
    const formattedDate = new Date(data.datetime).toLocaleString(undefined, {
      timeZoneName: 'short'
    });
  
    // Create a blob URL for the PDF if present
    const flyerURL = data.file ? URL.createObjectURL(data.file) : '';
  
    // Build preview HTML
    container.innerHTML = `
      <div class="bg-white pa4 br3 shadow-2">
        <h3 class="f3 mb3">🎯 Event Preview</h3>
        <ul class="list pl0 mb4">
          <li class="mb2"><strong>Title:</strong> ${data.title}</li>
          <li class="mb2"><strong>Date & Time:</strong> ${formattedDate}</li>
          <li class="mb2"><strong>Description:</strong><br>${data.description}</li>
          <li class="mb2"><strong>Address:</strong> ${data.address}</li>
          ${data.sponsor ? `<li class="mb2"><strong>Sponsor:</strong> ${data.sponsor}</li>` : ''}
          ${data.contactEmail ? `<li class="mb2"><strong>Email:</strong> ${data.contactEmail}</li>` : ''}
          ${data.contactPhone ? `<li class="mb2"><strong>Phone:</strong> ${data.contactPhone}</li>` : ''}
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
  
    // Wire up the buttons
    document
      .getElementById('cancelPreview')
      .addEventListener('click', () => {
        document.querySelector('#eventForm').style.display = 'block';
        container.style.display = 'none';
      });
  
    document
      .getElementById('confirmSubmit')
      .addEventListener('click', () => {
        // The click handler for confirmSubmit is still set in event-form.js
        // We assume event-form.js attaches its own listener after renderPreview
      });
  
    // Show the preview container
    container.style.display = 'block';
  }
  