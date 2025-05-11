// static/js/events/event-form.js

import { initMap, bindAddressSearch } from './event-map.js';
import { bindPdfPreview, showError, toggleLoading, showSuccess } from './ui-feedback.js';
import { renderPreview } from './preview-renderer.js';
import { submitEvent } from './submit-event.js';
import {
  isValidEmail,
  isValidPhone,
  isFutureDate,
  areRequiredFieldsPresent,
} from './validation-utils.js';

// ——————————————————————————————————————————
// Form state
// ——————————————————————————————————————————
let formDataCache = {};

/**
 * Render the blank form into the DOM and wire up map, preview, and logic.
 * @param {Object} user  Authenticated user object
 */
 // static/js/events/event-form.js

export function renderForm(user) {
  const container = document.querySelector('#event-form');
  if (!container) return;

  // 1) Inject HTML
  container.innerHTML = getFormHTML();

  // 2) Initialize map & PDF preview, and guard the Next button
  const { map, setMarker } = initMap();
  bindPdfPreview();

  // disable Next until we have coords
  const nextBtn = document.querySelector('#previewEvent');
  if (nextBtn) nextBtn.disabled = true;
  document.addEventListener('locationSet', () => {
    if (nextBtn) nextBtn.disabled = false;
  });

  bindAddressSearch(setMarker);

  // 3) Wire form logic
  bindFormLogic(user);
}

/**
 * HTML template for the form.
 */
function getFormHTML() {
  return `
    <div class="w-100 flex items-center justify-center pa5" style="background-color: #f7f7f7;">
      <div class="w-100 w-90-m w-80-l mw6 pa4 br3 shadow-1 bg-white">
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
          <button type="button" id="searchAddress" class="f6 link dim br2 ph3 pv2 mb1 dib white bg-dark-blue w-100" title="Enter an address, then click me or click on the map">
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

          <div id="map" class="br2 mb3" style="height: 300px; border: 1px solid #ccc;"></div>

          <label for="eventPdf" class="db mb2 fw6">Attach PDF Flyer</label>
          <input type="file" id="eventPdf" accept="application/pdf" class="input-reset ba b--black-20 pa2 mb3 w-100">
          <iframe id="pdfPreview" class="mb3" style="width:100%; height:300px; border:1px solid #ddd; display:none;"></iframe>

          <input type="hidden" id="lat">
          <input type="hidden" id="lng">

          <button type="button" id="previewEvent" class="f5 link dim br3 ph3 pv3 mb2 dib white bg-green w-100" disabled>
            Next → Preview
          </button>
        </form>

        <div id="event-preview" class="dn mt4"></div>
      </div>
    </div>
  `;
}

/**
 * Wire up preview & submit handling.
 * @param {Object} user
 */
function bindFormLogic(user) {
  const previewBtn = document.querySelector('#previewEvent');
  if (!previewBtn) return;

  // Preview step uses the authenticated user's ID
  previewBtn.addEventListener('click', () => handlePreview(user));

  // Delegate confirmSubmit click for dynamic preview content
  document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'confirmSubmit') {
      await handleSubmit();
    }
  });
}

/**
 * Gather, validate, map to Worker schema, and show preview.
 * @param {Object} user
 */
function handlePreview(user) {
  const $ = (id) => document.getElementById(id);
  const values = {
    title: $('title').value.trim(),
    datetime: $('datetime').value,
    description: $('description').value.trim(),
    address: $('address').value.trim(),
    sponsor: $('sponsor').value.trim(),
    contactEmail: $('contactEmail').value.trim(),
    contactPhone: $('contactPhone').value.trim(),
    lat: $('lat').value,
    lng: $('lng').value,
    file: $('eventPdf').files[0],
  };

  // Ensure required fields and a PDF are present
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

  // Convert to ISO and validate
  const isoDate = new Date(values.datetime).toISOString();
  if (!isFutureDate(isoDate)) return showError('Date must be in the future.');
  if (values.contactEmail && !isValidEmail(values.contactEmail))
    return showError('Invalid email.');
  if (values.contactPhone && !isValidPhone(values.contactPhone))
    return showError('Invalid phone.');

  // Map our UI fields to the Worker’s expected keys
  formDataCache = {
    userId: user.uid,
    name: values.title,
    date: isoDate,
    description: values.description,
    location: values.address,
    sponsor: values.sponsor,
    contact_email: values.contactEmail,
    contact_phone: values.contactPhone,
    lat: values.lat,
    lng: values.lng,
    file: values.file,
  };

  // Show preview
  renderPreview(formDataCache);

  // Toggle visibility
  $('eventForm').style.display = 'none';
  $('event-preview').style.display = 'block';
}

/**
 * Submit the event to the Worker and handle UI feedback.
 */
async function handleSubmit() {
  toggleLoading(true, '#confirmSubmit', 'Submitting…');

  const { ok, message } = await submitEvent(formDataCache);

  toggleLoading(false, '#confirmSubmit', '✅ Confirm & Submit');
  if (ok) {
    showSuccess('🎉 Event has been scheduled!');
    resetForm();
  } else {
    showError(message);
  }
}

/**
 * Reset both form and preview for another entry.
 */
function resetForm() {
  const form = document.querySelector('#eventForm');
  const preview = document.querySelector('#event-preview');
  if (form) {
    form.reset();
    form.style.display = 'block';
  }
  if (preview) {
    preview.innerHTML = '';
    preview.style.display = 'none';
  }
}
