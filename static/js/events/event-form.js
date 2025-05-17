// static/js/events/event-form.js

import { initMap, bindAddressSearch } from './event-map.js';
import { bindPdfPreview, showError, showSuccessModal, toggleLoading } from './ui-feedback.js';
import { renderPreview } from './preview-renderer.js';
import { submitEvent } from './submit-event.js';
import {
  isValidEmail,
  isValidPhone,
  areRequiredFieldsPresent,
} from './validation-utils.js';
// Maximum allowed PDF size in bytes (5 MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ——————————————————————————————————————————
// Submit handler
// ——————————————————————————————————————————
async function handleSubmit() {
  // 0) Block if preview hasn’t run
  if (!formDataCache || !formDataCache.date) {
    return showError('Please click Next → Preview first.');
  }

  const confirmBtn = document.getElementById('confirmSubmit');
  toggleLoading(true, confirmBtn, 'Submitting…');

  try {
    const { ok, id, message } = await submitEvent(formDataCache);
    console.log('handleSubmit: got response', { ok, id, message });
    if (ok) {
      showSuccessModal(() => {
        window.location.href = `/events?highlight=${id}`;
      });
      resetForm();
    } else {
      showError(message);
    }
  } catch (err) {
    console.error('Unexpected error during submission:', err);
    showError('An unexpected error occurred. Please try again.');
  } finally {
    toggleLoading(false, confirmBtn, '✅ Confirm & Submit');
  }
}

// ——————————————————————————————————————————
// Form state
// ——————————————————————————————————————————
let formDataCache = {};

/**
 * Render the blank form into the DOM and wire up map, preview, and logic.
 * @param {Object} user  Authenticated user object
 */
export function renderForm(user) {
  const container = document.querySelector('#event-form');
  if (!container) return;

  // 1) Inject HTML
  container.innerHTML = getFormHTML();

  // ————————————————
  // Client-side PDF size guard (uses .file-error CSS)
  // ————————————————
  const fileInput  = document.getElementById('eventPdf');
  const previewBtn = document.getElementById('previewEvent');

  // Create & insert the error message
  const fileError = document.createElement('p');
  fileError.id          = 'file-error';
  fileError.className   = 'file-error';
  fileError.textContent = 'File too large. Maximum size is 5 MB.';
  fileError.style.display = 'none';
  fileInput.parentNode.insertBefore(fileError, fileInput.nextSibling);

  // Block oversize files before allowing Preview
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file && file.size > MAX_FILE_SIZE) {
      fileError.style.display    = 'block';
      previewBtn.disabled        = true;
      previewBtn.setAttribute('aria-disabled', 'true');
      previewBtn.classList.add('opacity-50');
    } else {
      fileError.style.display    = 'none';
      previewBtn.disabled        = false;
      previewBtn.setAttribute('aria-disabled', 'false');
      previewBtn.classList.remove('opacity-50');
    }
  });

  // 1b) Hide the success modal
  document.getElementById('successModal')?.classList.add('dn');

  // 2) Prevent past dates
  const dateInput = document.getElementById('datetime');
  if (dateInput) {
    const now   = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    dateInput.min = local.toISOString().slice(0, 16);
  }

  // 3) Initialize map & PDF preview
  const { map, setMarker: originalSetMarker } = initMap();
  bindPdfPreview();

  // 4) Wrap setMarker → fires locationSet
  const setMarker = (...args) => {
    originalSetMarker(...args);
    document.dispatchEvent(new Event('locationSet'));
  };
  bindAddressSearch(setMarker);

  // 5) Enable Next→Preview on locationSet
  const nextBtn = document.getElementById('previewEvent');
  document.addEventListener('locationSet', () => {
    nextBtn.setAttribute('aria-disabled', 'false');
    nextBtn.classList.remove('opacity-50');
  });

  // 6) Wire up preview & confirm
  bindFormLogic(user);
}


/**
 * HTML template for the form.
 */
function getFormHTML() {
  return `
    <div class="w-100 flex items-center justify-center pa5 cr-event-bg">
      <div class="w-100 w-90-m w-80-l mw6 pa4 br3 shadow-1 bg-white cr-event-card">
        <h2 class="f3 fw6 tc mb4">Create an Event</h2>
        <form id="eventForm" class="flex flex-column">
          <label for="title" class="db mb2 fw6">Event Title</label>
          <input type="text" id="title" required class="input-reset ba b--black-20 pa2 mb3 w-100">

          <label for="datetime" class="db mb2 fw6">Event Date &amp; Time</label>
          <input type="datetime-local" id="datetime" required class="input-reset ba b--black-20 pa2 mb3 w-100">

          <label for="description" class="db mb2 fw6">Description</label>
          <textarea id="description" required class="input-reset ba b--black-20 pa2 mb3 w-100" rows="4"></textarea>

          <label for="address" class="db mb2 fw6">Event Address or ZIP Code</label>
          <input type="text" id="address" class="input-reset ba b--black-20 pa2 w-100 mb2">
          <button type="button" id="searchAddress" class="f6 link dim br2 ph3 pv2 mb1 dib white bg-dark-blue w-100">
            🔍 Search Address
          </button>
          <small class="f7 gray mb3">
            Enter an address and click 🔍, or click directly on the map below to set your location.
          </small>

          <label for="sponsor" class="db mb2 fw6">Sponsoring Organization (optional)</label>
          <input type="text" id="sponsor" class="input-reset ba b--black-20 pa2 mb3 w-100">

          <label for="contactEmail" class="db mb2 fw6">Contact Email (optional)</label>
          <input type="email" id="contactEmail" class="input-reset ba b--black-20 pa2 mb3 w-100">

          <label for="contactPhone" class="db mb2 fw6">Contact Phone (optional)</label>
          <input type="tel" id="contactPhone" class="input-reset ba b--black-20 pa2 mb3 w-100">

          <div id="map" class="br2 mb3"></div>

          <label for="eventPdf" class="db mb2 fw6">
            Attach PDF Flyer <span class="f7 gray">(Limit: 5 MB)</span>
          </label>
          <input type="file" id="eventPdf" accept="application/pdf" class="input-reset ba b--black-20 pa2 mb3 w-100">
          <iframe id="pdfPreview" class="mb3" style="display:none;"></iframe>

          <input type="hidden" id="lat">
          <input type="hidden" id="lng">

          <button 
            type="button" 
            id="previewEvent" 
            class="f5 link dim br3 ph3 pv3 mb2 dib white bg-green w-100 opacity-50" 
            aria-disabled="true"
          >
            Next → Preview
          </button>
        </form>

        <div id="event-preview" class="dn mt4"></div>
      </div>
    </div>

    <!-- Success Modal -->
    <div id="successModal" class="cr-modal-overlay">
      <div class="cr-modal-content">
        <h3 class="f3 mb3">Success!</h3>
        <p class="mb4">Your event has been created.</p>
        <button id="viewEventBtn" class="f5 link dim br3 ph3 pv2 white bg-blue">
          View on Map
        </button>
      </div>
    </div>
  `;
}


/**
 * Wire up Preview & Confirm handling.
 */
function bindFormLogic(user) {
  const previewBtn = document.getElementById('previewEvent');
  if (!previewBtn) return;

  previewBtn.addEventListener('click', () => {
    const isDisabled = previewBtn.getAttribute('aria-disabled') === 'true';
    if (isDisabled) {
      showError('Please select a location first: search an address or click on the map.');
    } else {
      handlePreview(user);
      bindConfirm(); // attach Confirm click only once
    }
  });
}

/**
 * After renderPreview() toggles into the preview pane, wire the Confirm button.
 */
function bindConfirm() {
  const confirmBtn = document.getElementById('confirmSubmit');
  if (!confirmBtn) return;

  confirmBtn.addEventListener('click', async () => {
    await handleSubmit();
  }, { once: true });
}

/**
 * Gather, validate, map to Worker schema, and show preview.
 * @param {Object} user
 */
function handlePreview(user) {
  const $ = id => document.getElementById(id);

  // 1) Gather & trim values
  const values = {
    title:        $('title').value.trim(),
    datetime:     $('datetime').value.trim(),
    description:  $('description').value.trim(),
    address:      $('address').value.trim(),
    sponsor:      $('sponsor').value.trim(),
    contactEmail: $('contactEmail').value.trim(),
    contactPhone: $('contactPhone').value.trim(),
    lat:          $('lat').value,
    lng:          $('lng').value,
    file:         $('eventPdf').files[0],
  };

  // 2) Required fields + PDF
  if (
    !areRequiredFieldsPresent([
      values.title,
      values.datetime,
      values.description,
      values.address,
      values.lat,
      values.lng,
    ]) ||
    !values.file
  ) {
    return showError('Please complete all required fields.');
  }

  // 3) Date validation
  const dateInput = document.getElementById('datetime');
  dateInput.setCustomValidity(''); // clear any prior error

  // 3a) Required
  if (!values.datetime) {
    dateInput.setCustomValidity('Please enter an event date & time.');
    dateInput.reportValidity();
    dateInput.focus();
    return;
  }

  // 3b) Well‑formed
  const dateObj = new Date(values.datetime);
  if (isNaN(dateObj.getTime())) {
    dateInput.setCustomValidity('That date/time is not valid.');
    dateInput.reportValidity();
    dateInput.focus();
    return;
  }

  // 3c) Future‑only
  if (dateObj <= new Date()) {
    dateInput.setCustomValidity('Date must be in the future.');
    dateInput.reportValidity();
    dateInput.focus();
    return;
  }

  // Clear the custom validity now that it's valid
  dateInput.setCustomValidity('');
  const isoDate = dateObj.toISOString();

  // 4) Optional contact validations
  if (values.contactEmail && !isValidEmail(values.contactEmail)) {
    return showError('Invalid email address.');
  }
  if (values.contactPhone && !isValidPhone(values.contactPhone)) {
    return showError('Invalid phone number.');
  }

  // 5) Map to payload schema for D1 and preview-renderer
  //    Use the same keys your Worker and D1 expect
  formDataCache = {
    user_id:        user.uid,
    name:           values.title,
    date:           isoDate,
    description:    values.description,
    location:       values.address,
    sponsor:        values.sponsor,
    contact_email:  values.contactEmail,
    contact_phone:  values.contactPhone,
    lat:            values.lat,
    lng:            values.lng,
    file:           values.file,
  };

  // 6) Render preview & swap views
  console.log('🛰️ Preview coords:', formDataCache.lat, formDataCache.lng);
  renderPreview(formDataCache);
  $('eventForm').style.display     = 'none';
  $('event-preview').style.display = 'block';
}

/**
 * Reset both form and preview for another entry.
 */
function resetForm() {
  // Hide success modal & clear cache
  console.log('resetForm: hiding successModal');
  document.getElementById('successModal')?.classList.add('dn');
  formDataCache = {};

  // Reset Next→Preview state
  const nextBtn = document.getElementById('previewEvent');
  if (nextBtn) {
    nextBtn.setAttribute('aria-disabled', 'true');
    nextBtn.classList.add('opacity-50');
  }

  // Reset form & preview pane
  const form = document.getElementById('eventForm');
  const preview = document.getElementById('event-preview');
  if (form) {
    form.reset();
    form.style.display = 'block';
  }
  if (preview) {
    preview.innerHTML = '';
    preview.style.display = 'none';
  }
}