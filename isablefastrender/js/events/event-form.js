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

const MAX_FILE_SIZE = 5 * 1024 * 1024;
let formDataCache = {};

/**
 * Initialize the Event Creation Flow once DOM is ready and user is authenticated.
 * @param {Object} user  Authenticated user object
 */
export function renderForm(user) {
  const container = document.querySelector('#event-form');
  if (!container) {
    console.warn('No #event-form container found—skipping Event Form init');
    return;
  }

  // 1) PDF size guard
  const fileInput  = document.getElementById('eventPdf');
  const previewBtn = document.getElementById('previewEvent');
  if (!fileInput || !previewBtn) {
    console.warn('Form inputs not found—check event-form.html markup');
    return;
  }

  const fileError = document.createElement('p');
  fileError.id        = 'file-error';
  fileError.className = 'text-red-600 text-sm';
  fileError.textContent = 'File too large. Maximum size is 5 MB.';
  fileError.hidden    = true;
  fileInput.after(fileError);

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file && file.size > MAX_FILE_SIZE) {
      fileError.hidden      = false;
      previewBtn.disabled   = true;
      previewBtn.classList.add('opacity-50');
    } else {
      fileError.hidden      = true;
      previewBtn.disabled   = false;
      previewBtn.classList.remove('opacity-50');
    }
  });

  // 2) Hide success modal initially
  const successModal = document.getElementById('successModal');
  if (successModal) {
    successModal.classList.add('hidden');
    successModal.setAttribute('aria-hidden', 'true');
  }

  // 3) Prevent past dates
  const dateInput = document.getElementById('datetime');
  if (dateInput) {
    const now   = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    dateInput.min = local.toISOString().slice(0, 16);
  }

  // 4) Initialize map & PDF preview
  bindPdfPreview();
  const { map, setMarker: originalSetMarker } = initMap();
  const setMarker = (...args) => {
    originalSetMarker(...args);
    document.dispatchEvent(new Event('locationSet'));
  };
  bindAddressSearch(setMarker);

  // 5) Enable Preview button once location is set
  document.addEventListener('locationSet', () => {
    previewBtn.disabled             = false;
    previewBtn.classList.remove('opacity-50');
    previewBtn.setAttribute('aria-disabled', 'false');
  });

  // 6) Wire up preview & confirm
  bindFormLogic(user);
}

function bindFormLogic(user) {
  const previewBtn = document.getElementById('previewEvent');
  if (!previewBtn) return;

  previewBtn.addEventListener('click', () => {
    if (previewBtn.disabled) {
      showError('Please select a location first: search an address or click on the map.');
    } else {
      console.log('🔍 Preview button clicked — running handlePreview');
      handlePreview(user);
      bindConfirm();
    }
  });
}

function bindConfirm() {
  const confirmBtn = document.getElementById('confirmSubmit');
  if (!confirmBtn) return;

  confirmBtn.addEventListener('click', async () => {
    await handleSubmit();
  }, { once: true });
}

async function handleSubmit() {
  const confirmBtn = document.getElementById('confirmSubmit');
  toggleLoading(true, confirmBtn, 'Submitting…');

  try {
    const { ok, id, message } = await submitEvent(formDataCache);
    if (ok) {
      showSuccessModal(() => {
        window.location.href = `/events?highlight=${id}`;
      });
      resetForm();
    } else {
      showError(message);
    }
  } catch (err) {
    console.error(err);
    showError('An unexpected error occurred. Please try again.');
  } finally {
    toggleLoading(false, confirmBtn, 'Confirm & Submit');
  }
}

function handlePreview(user) {
  const $ = id => document.getElementById(id);
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

  // … validation as before …

  // Cache payload
  formDataCache = {
    user_id:       user.uid,
    name:          values.title,
    date:          new Date(values.datetime).toISOString(),
    description:   values.description,
    location:      values.address,
    sponsor:       values.sponsor,
    contact_email: values.contactEmail,
    contact_phone: values.contactPhone,
    lat:           values.lat,
    lng:           values.lng,
    file:          values.file,
  };

 // Render the preview
renderPreview(formDataCache);

// Now swap out the heading + form for the preview pane
const wrapper = document.getElementById('event-form');
const heading = wrapper.querySelector('h2');
const formEl  = document.getElementById('eventForm');
const preview = document.getElementById('event-preview');

if (wrapper && heading && formEl && preview) {
  // 1) Hide the heading
  heading.classList.add('hidden');
  
  // 2) Hide the form
  formEl.classList.add('hidden');

  // 3) Show the preview
  preview.classList.remove('hidden');

  // 4) Keep the wrapper flex-centered
  wrapper.classList.add('flex', 'items-center', 'justify-center');
}

}


function resetForm() {
  formDataCache = {};
  const form = document.getElementById('eventForm');
  form.reset();
  form.hidden = false;

  const previewPane = document.getElementById('event-preview');
  previewPane.innerHTML = '';
  previewPane.hidden    = true;

  const previewBtn = document.getElementById('previewEvent');
  previewBtn.disabled             = true;
  previewBtn.classList.add('opacity-50');
  previewBtn.setAttribute('aria-disabled', 'true');
}
