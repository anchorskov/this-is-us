/* Renders the read-only preview card and handles the “Publish” step
    ---------------------------------------------------------------- */
import { submitEvent } from '../submit-event.js';
// Updated import: Get the right modal function and the loading helper
import { showSuccessModal, toggleLoading } from '../ui-feedback.js';
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

const auth = getAuth();

export function renderPreview() {
  const pane = document.getElementById('event-preview');
  const form = document.getElementById('eventForm');
  if (!pane || !form) {
    console.warn('⚠️ preview-renderer: missing pane or form – abort');
    return;
  }

  /* ── 1) harvest form data ─────────────────────────────────────── */
  const data = Object.fromEntries(new FormData(form).entries());
  const fileInput = document.getElementById('eventPdf');

  // Map front-end names → Worker names
  data.name = (data.title || '').trim();
  data.date = data.datetime;
  data.location = data.location || document.getElementById('street')?.value || '';
  data.description = (data.description || '').trim();
  data.lat = document.getElementById('lat')?.value || '';
  data.lng = document.getElementById('lng')?.value || '';

  // Get the actual selected file, if it exists
  data.file = fileInput.files[0];

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
                     hover:bg-indigo-700 transition w-full sm:w-auto">
        📤 Submit Event
      </button>
      <p id="publishError" class="text-red-600 text-sm mt-2 hidden"></p>
    </div>`;

  /* ── 3) wire Publish ─────────────────────────────────────────── */
  const btn = document.getElementById('publishBtn');
  const errLabel = document.getElementById('publishError');

  btn.addEventListener('click', async () => {
    errLabel.classList.add('hidden');
    errLabel.textContent = '';

    if (!data.lat || !data.lng) {
      errLabel.textContent = 'Please set a map location first.';
      errLabel.classList.remove('hidden');
      return;
    }

    const authUser = auth.currentUser;
    if (!authUser) {
      errLabel.textContent = 'Please sign in to submit your event.';
      errLabel.classList.remove('hidden');
      return;
    }

    data.userId = authUser.uid;
    data.userEmail = authUser.email || '';
    data.userDisplayName = authUser.displayName || '';

    try {
      // Use the toggleLoading helper for a better UX
      toggleLoading(true, btn);

      const { ok, message, id } = await submitEvent(data);

      if (ok) {
        console.log('🎉 submitEvent OK → id:', id);
        // Correctly call the success MODAL function
        // It takes a callback for the "View on Map" button
        showSuccessModal(() => {
          window.location.href = `/events//`; // Redirect to the new event page
        });
      } else {
        throw new Error(message || 'Unexpected API error');
      }
    } catch (err) {
      console.error('❌ publish failed:', err);
      errLabel.textContent = err.message;
      errLabel.classList.remove('hidden');
    } finally {
      // Always restore the button's state
      toggleLoading(false, btn, '📤 Submit Event');
    }
  }, { once: true });
}
