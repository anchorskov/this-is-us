/*  zip-first locator → full form → preview
    --------------------------------------------------------------- */
import { setupMapLocator } from './map-locator.js';
import { renderPreview    } from './preview-renderer.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('📋 form-flow.js loaded');

  /* ✨ NEW: PDF Uploader UI Logic */
  const actualPdfInput = document.getElementById('eventPdf');
  const fileChosenDisplay = document.getElementById('file-chosen');

  if (actualPdfInput && fileChosenDisplay) {
    actualPdfInput.addEventListener('change', function() {
      // Check if any file is selected
      if (this.files.length > 0) {
        // Display the name of the first file
        fileChosenDisplay.textContent = this.files[0].name;
        fileChosenDisplay.classList.remove('italic', 'text-gray-600');
        fileChosenDisplay.classList.add('text-black');
      } else {
        // If the user cancels the file dialog
        fileChosenDisplay.textContent = 'No file chosen';
        fileChosenDisplay.classList.add('italic', 'text-gray-600');
        fileChosenDisplay.classList.remove('text-black');
      }
    });
  }

  /* 1️⃣  Date-picker helper */
  document.getElementById('confirmDateTime')
    ?.addEventListener('click', () =>
      document.getElementById('description')?.focus()
    );

  /* 2️⃣  Bootstrap map-locator */
  setupMapLocator({
    mapId   : 'map',
    formId  : 'addressForm',
    errorId : 'errorMsg',
    resultId: 'latlonDisplay',
  });

  /* 3️⃣  OK-button → reveal full form (and wire preview once) */
  const okBtn   = document.getElementById('loc-ok');
  const formBox = document.getElementById('event-form');
  if (!okBtn || !formBox) return;                    // hard-fail early

  /* Enable OK only after the map fires locationSet */
  document.addEventListener('locationSet', () => {
    okBtn.disabled = false;
    okBtn.classList.remove('opacity-50');
    okBtn.setAttribute('aria-disabled', 'false');
    okBtn.focus();
  });

  /* First (and only) click on OK shows the form and binds preview */
  okBtn.addEventListener('click', () => {
    if (okBtn.disabled) return;                      // guard

    okBtn.disabled = true;                           // lock OK
    formBox.classList.remove('hidden');
    formBox.scrollIntoView({ behavior:'smooth', block:'start' });

    const previewBtn = document.getElementById('previewEvent');
    if (!previewBtn) return;

    previewBtn.disabled = false;
    previewBtn.classList.remove('opacity-50');
    previewBtn.setAttribute('aria-disabled', 'false');

    /* Bind preview exactly ONCE */
    previewBtn.addEventListener('click', () => {
      if (!document.getElementById('lat')?.value) {
        alert('Please pick a location first.');
        return;
      }

      renderPreview();                               // build preview card

      formBox.parentElement.classList.add('hidden');
      const pane = document.getElementById('event-preview');
      pane.classList.remove('hidden');
      pane.scrollIntoView({ behavior:'smooth' });
    }, { once:true });

    document.getElementById('title')?.focus();
  }, { once:true });                                 // prevent re-bindings
});
