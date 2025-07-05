// ——————————————————————————————————————————
// Simple DOM selector static/js/events/ui-feedback.js
// ——————————————————————————————————————————
/**
 * Accept either a selector string or an Element.
 * If passed a string, runs querySelector; otherwise returns the element.
 */
function $(elOrSelector) {
  return (typeof elOrSelector === 'string')
    ? document.querySelector(elOrSelector)
    : elOrSelector;
}

// ——————————————————————————————————————————
// Toast Notifications
// ——————————————————————————————————————————
const TOAST_CONTAINER_ID = 'toast-container';

/**
 * Show a toast message.
 * @param {string} message
 * @param {'info'|'success'|'error'} [type='info']
 * @param {number} [duration=4000] in ms
 */
export function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.className = 'fixed top-4 right-4 space-y-2';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `px-4 py-2 rounded shadow-lg bg-white border-l-4 border-${
    type === 'error' ? 'red-500' : type === 'success' ? 'green-500' : 'blue-500'
  } text-${
    type === 'error' ? 'red-700' : type === 'success' ? 'green-700' : 'blue-700'
  }`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
    if (!container.hasChildNodes()) {
      container.remove();
    }
  }, duration);
}

// ——————————————————————————————————————————
// Loading State Handler
// ——————————————————————————————————————————
/**
 * Enable or disable a button and swap its label.
 * @param {boolean} isLoading
 * @param {string|HTMLElement} btnOrSelector  Button element or CSS selector
 * @param {string} [label='📤 Submit Event']
 */
export function toggleLoading(isLoading, btnOrSelector, label = '📤 Submit Event') {
  const btn = typeof btnOrSelector === 'string' ? $(btnOrSelector) : btnOrSelector;
  if (!btn) return;
  btn.disabled = isLoading;
  if (isLoading) {
    btn.innerHTML = `
      <svg class="animate-spin h-4 w-4 inline-block mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
      </svg>
      Submitting…
    `.trim();
  } else {
    btn.innerHTML = label;
  }
}

// ——————————————————————————————————————————
// Success / Error Wrappers
// ——————————————————————————————————————————
/**
 * Show a success toast.
 * @param {string} [message='Event submitted successfully!']
 */
export function showSuccess(message = 'Event submitted successfully!') {
  showToast(message, 'success');
}

/**
 * Show an error toast.
 * @param {Error|string} error
 */
export function showError(error) {
  const msg = (error && error.message) || error || 'Something went wrong';
  console.error('❌', msg);
  showToast(msg, 'error');
}

// ——————————————————————————————————————————
// PDF Preview Binding
// ——————————————————————————————————————————
/**
 * Wire a PDF file input to display its preview in an iframe.
 * @param {string} [inputSel='#eventPdf']
 * @param {string} [iframeSel='#pdfPreview']
 */
export function bindPdfPreview(inputSel = '#eventPdf', iframeSel = '#pdfPreview') {
  const input = $(inputSel);
  const iframe = $(iframeSel);
  if (!input || !iframe) return;

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file && file.type === 'application/pdf') {
      iframe.src = URL.createObjectURL(file);
      iframe.hidden = false;
    } else {
      iframe.src = '';
      iframe.hidden = true;
    }
  });
}

// ——————————————————————————————————————————
// Success Modal
// ——————————————————————————————————————————
/**
 * Display the success modal; wires OK / View buttons once.
 * @param {Function} onView  callback when "View on Map" is clicked
 */
export function showSuccessModal(onView) {
  const modal = document.getElementById('successModal');
  if (!modal) return console.warn('❌ successModal not found');

  // ── reveal overlay ─────────────────────────────────────────────
  modal.classList.remove('hidden');
  modal.style.display = 'flex';              // UnoCSS sets nothing → force flex
  modal.setAttribute('aria-hidden', 'false');
  modal.tabIndex = -1;                       // allow focus-trap helpers
  modal.focus({ preventScroll: true });

  // ── buttons ───────────────────────────────────────────────────
  const okBtn   = document.getElementById('okEventBtn');
  const viewBtn = document.getElementById('viewEventBtn');

  if (okBtn  && !okBtn._wired) {
    okBtn._wired = true;
    okBtn.addEventListener('click', hide);
  }
  if (viewBtn && !viewBtn._wired) {
    viewBtn._wired = true;
    viewBtn.addEventListener('click', () => { onView?.(); hide(); });
  }

  // ── new: close on ⎋ or overlay click ──────────────────────────
  function onKey(e) { if (e.key === 'Escape') hide(); }
  document.addEventListener('keydown', onKey, { once: true });
  modal.addEventListener('click', e => {
    if (e.target === modal) hide();          // click outside the card
  }, { once: true });

  // ── hide helper ───────────────────────────────────────────────
  function hide() {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }
}


