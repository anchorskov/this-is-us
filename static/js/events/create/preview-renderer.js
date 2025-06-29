/*  Renders the read-only preview card and handles the “Publish” step
    ---------------------------------------------------------------- */
import { submitEvent } from '../submit-event.js';
import { showSuccess } from './modal.js';

export function renderPreview() {
  const pane = document.getElementById('event-preview');
  const form = document.getElementById('eventForm');
  if (!pane || !form) {
    console.warn('⚠️ preview-renderer: missing pane or form – abort');
    return;
  }

  /* ── 1) harvest form data ─────────────────────────────────────── */
  const data = Object.fromEntries(new FormData(form).entries());

  // Map front-end names → Worker names
  data.name        = (data.title || '').trim();           // title  ➜ name
  data.date        =  data.datetime;                      // datetime ➜ date
  data.location    =  data.location ||
                      document.getElementById('street')?.value || '';

  data.description = (data.description || '').trim();
  data.lat = document.getElementById('lat')?.value || '';
  data.lng = document.getElementById('lng')?.value || '';

  /* Worker requires a File field; use a 1-byte dummy until a real
     file-input is added. Remove this stub when you add <input type="file">. */
  data.file = new File(['%'], 'placeholder.pdf', {
    type : 'application/pdf',
    lastModified: Date.now()
  });

  /* ── 2) inject read-only card ─────────────────────────────────── */
  pane.innerHTML = /* html */`
    <div class="border rounded p-4 bg-white shadow">
      <h3 class="text-xl font-semibold mb-2">
        ${data.name || 'Untitled event'}
      </h3>

      <p class="text-sm text-gray-500 mb-2">
        ${data.date
          ? new Date(data.date).toLocaleString()
          : 'No date chosen'}
      </p>

      <p class="whitespace-pre-wrap mb-4">${data.description || ''}</p>

      <button id="publishBtn"
              class="px-6 py-3 rounded bg-indigo-600 text-white
                     hover:bg-indigo-700 transition">
        ✅ Publish Event
      </button>
      <p id="publishError" class="text-red-600 text-sm mt-2 hidden"></p>
    </div>`;

  /* ── 3) wire Publish ─────────────────────────────────────────── */
  const btn      = document.getElementById('publishBtn');
  const errLabel = document.getElementById('publishError');

  btn.addEventListener('click', async () => {
    errLabel.classList.add('hidden');
    errLabel.textContent = '';

    if (!data.lat || !data.lng) {
      errLabel.textContent = 'Please set a map location first.';
      errLabel.classList.remove('hidden');
      return;
    }

    try {
      btn.disabled   = true;
      btn.textContent = 'Publishing…';

      const { ok, message, id } = await submitEvent(data);

      if (ok) {
        console.log('🎉 submitEvent OK → id:', id);
        showSuccess(id);                // open success modal
      } else {
        throw new Error(message || 'Unexpected API error');
      }
    } catch (err) {
      console.error('❌ publish failed:', err);
      errLabel.textContent = err.message;
      errLabel.classList.remove('hidden');
    } finally {
      btn.disabled   = false;
      btn.textContent = '✅ Publish Event';
    }
  }, { once:true }); // prevent double-submits
}
