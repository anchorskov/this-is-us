// static/js/events/ui-feedback.js

// ——————————————————————————————————————————
// Simple DOM selector
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
      document.body.appendChild(container);
    }
  
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
  
    setTimeout(() => {
      container.removeChild(toast);
      if (!container.hasChildNodes()) {
        container.remove();
      }
    }, duration);
  }
  
  // ——————————————————————————————————————————
  // Loading Indicator
  // ——————————————————————————————————————————
  /**
   * Enable or disable a button and swap its label.
   * @param {boolean} isLoading
   * @param {string} selector  Button CSS selector
   * @param {string} [label='📤 Submit Event']
   */
  export function toggleLoading(isLoading, selector, label = '📤 Submit Event') {
    const btn = $(selector);
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading
      ? `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting…`
      : label;
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
   * Wire a PDF‐file input to display its preview.
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
        iframe.style.display = 'block';
      } else {
        iframe.src = '';
        iframe.style.display = 'none';
      }
    });
  }
  /**
 * Show our success modal and wire the View and OK buttons.
 * @param {Function} onView callback when they click “View on Map”
 */
export function showSuccessModal(onView) {
  const modal = document.getElementById('successModal');
  if (!modal) return;

  // Ensure modal has content area to inject buttons
  const content = modal.querySelector('.modal-content');
  if (!content) return;

  // Inject View and OK buttons if not already present
  content.innerHTML = `
    <p>✅ Event submitted successfully!</p>
    <div class="mt3">
      <button id="viewEventBtn" class="mr2 pa2 bg-blue white br2">View on Map</button>
      <button id="okEventBtn" class="pa2 bg-green white br2">OK</button>
    </div>
  `;

  // Show the modal
  modal.style.display = 'flex';

  // Backdrop click closes modal
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });

  // Wire up buttons
  const viewBtn = document.getElementById('viewEventBtn');
  const okBtn = document.getElementById('okEventBtn');

  if (viewBtn) {
    viewBtn.onclick = () => {
      onView();
      modal.style.display = 'none';
    };
  }

  if (okBtn) {
    okBtn.onclick = () => {
      modal.style.display = 'none';
    };
  }
}

