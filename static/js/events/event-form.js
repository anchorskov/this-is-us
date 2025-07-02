// static/js/events/event-form.js
import { initMap, bindAddressSearch }       from './event-map.js';
import { bindPdfPreview, showError,
         showSuccessModal, toggleLoading }   from './ui-feedback.js';
import { renderPreview }                    from './preview-renderer.js';
import { submitEvent }                      from './submit-event.js';
import { isValidEmail, isValidPhone,
         areRequiredFieldsPresent }         from './validation-utils.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
let   formDataCache = {};

/* -------------------------------------------------- */
/* helper: stitch the address pieces back together    */
/* -------------------------------------------------- */
const buildAddress = () => {
  const street = document.getElementById('street')?.value.trim();
  const city   = document.getElementById('city')?.value.trim();
  const state  = document.getElementById('state')?.value.trim();
  const zip    = document.getElementById('zip')?.value.trim();
  return [street, city, state, zip].filter(Boolean).join(', ');
};

/* -------------------------------------------------- */
/* main bootstrap after auth                          */
/* -------------------------------------------------- */
export function renderForm(user) {
  const wrapper = document.querySelector('#event-form');
  if (!wrapper) return console.warn('No #event-form wrapper found.');

  /* 1️⃣ PDF size guard ---------------------------------------- */
  const fileInput  = document.getElementById('eventPdf');  // <input id="eventPdf" name="file">
  const previewBtn = document.getElementById('previewEvent');
  if (!fileInput || !previewBtn) {
    console.warn('PDF or Preview button missing in markup.');
    return;
  }

  const fileError = Object.assign(document.createElement('p'), {
    id:        'file-error',
    className: 'text-red-600 text-sm',
    hidden:    true,
    textContent: 'File too large. Maximum size is 5 MB.',
  });
  fileInput.after(fileError);

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    const bad = f && f.size > MAX_FILE_SIZE;
    fileError.hidden    = !bad;
    previewBtn.disabled = bad;
    previewBtn.classList.toggle('opacity-50', bad);
  });

  /* 2️⃣ success modal hidden, past-date min, map preview ------ */
  document.getElementById('successModal')?.classList.add('hidden');

  const dt = document.getElementById('datetime');
  if (dt) dt.min = new Date(Date.now() - new Date().getTimezoneOffset()*6e4)
                    .toISOString().slice(0,16);

  bindPdfPreview();

  /* 3️⃣ map --------------------------------------------------- */
  const { setMarker: rawSetMarker } = initMap();
  const setMarker = (...xy) => { rawSetMarker(...xy); document.dispatchEvent(new Event('locationSet')); };
  bindAddressSearch('#address', '#searchAddress', setMarker); // still wires Street+ZIP search

  /* 4️⃣ enable preview after location ------------------------- */
  document.addEventListener('locationSet', () => {
    previewBtn.disabled = false;
    previewBtn.classList.remove('opacity-50');
  });

  /* 5️⃣ wire buttons ----------------------------------------- */
  bindFormLogic(user);
}

/* -------------------------------------------------- */
/* preview / confirm                                  */
/* -------------------------------------------------- */
function bindFormLogic(user) {
  const previewBtn = document.getElementById('previewEvent');
  if (!previewBtn) return;

  previewBtn.addEventListener('click', () => {
    if (previewBtn.disabled) {
      return showError('Pick a map location first.');
    }
    handlePreview(user);
    bindConfirm();            // only after preview shown
  });
}

function bindConfirm() {
  const btn = document.getElementById('confirmSubmit');
  if (btn) btn.addEventListener('click', handleSubmit, { once:true });
}

async function handleSubmit() {
  const btn = document.getElementById('confirmSubmit');
  toggleLoading(true, btn, 'Submitting…');
  try {
    const { ok, id, message } = await submitEvent(formDataCache);
    ok
      ? showSuccessModal(() => location.href = `/events?highlight=${id}`)
      : showError(message);
  } catch (err) {
    console.error(err);
    showError('Unexpected error; please retry.');
  } finally { toggleLoading(false, btn, 'Confirm & Submit'); }
}

/* -------------------------------------------------- */
/* preview pane                                       */
/* -------------------------------------------------- */
function handlePreview(user) {
  const $ = id => document.getElementById(id);
  const values = {
    title:        $('title').value.trim(),
    datetime:     $('datetime').value.trim(),
    description:  $('description').value.trim(),
    address:      buildAddress(),
    sponsor:      $('sponsor').value.trim(),
    contactEmail: $('contactEmail').value.trim(),
    contactPhone: $('contactPhone').value.trim(),
    lat:          $('lat').value,
    lng:          $('lng').value,
    file:         $('eventPdf').files[0],
  };

  /* TODO: run validation utils here */

  formDataCache = {
    user_id:       user?.uid ?? 'anonymous',
    name:          values.title,
    date:          new Date(values.datetime).toISOString(),
    description:   values.description,
    location:      values.address,
    sponsor:       values.sponsor,
    contact_email: values.contactEmail,
    contact_phone: values.contactPhone,
    lat:           values.lat,
    lng:           values.lng,
    file:          values.file,          // <-- the actual File object
  };

  renderPreview(formDataCache);

  // Swap form → preview
  const heading = document.querySelector('#event-form h2');
  document.getElementById('eventForm').classList.add('hidden');
  document.getElementById('event-preview').classList.remove('hidden');
  heading?.classList.add('hidden');
}

/* -------------------------------------------------- */
function resetForm() {
  formDataCache = {};
  const f = document.getElementById('eventForm');
  f.reset(); f.hidden = false;
  const pane = document.getElementById('event-preview');
  pane.innerHTML = ''; pane.hidden = true;
  const pb = document.getElementById('previewEvent');
  pb.disabled = true; pb.classList.add('opacity-50');
}
