// static/js/events/create/form-flow.js

// 1) Focus helper for Date-picker
document.addEventListener('DOMContentLoaded', () => {
  const doneBtn   = document.getElementById('confirmDateTime');
  const nextField = document.getElementById('description');
  doneBtn?.addEventListener('click', () => nextField?.focus());
});

// 2) Setup interactive location tool
import { setupMapLocator } from './map-locator.js';

document.addEventListener('DOMContentLoaded', () => {
  setupMapLocator({
    mapId: "map",
    formId: "addressForm",
    errorId: "errorMsg",
    resultId: "latlonDisplay"
  });
});

// 3) Location → enable OK button
document.addEventListener('DOMContentLoaded', () => {
  const okBtn   = document.getElementById('loc-ok');     // green OK button
  const formBox = document.getElementById('event-form'); // wrapper that starts hidden

  if (!okBtn || !formBox) return;

  // Enable OK when location is confirmed
  document.addEventListener('locationSet', () => {
    okBtn.disabled = false;
    okBtn.classList.remove('opacity-50');
    okBtn.setAttribute('aria-disabled', 'false');
    okBtn.focus();
  });

  // OK reveals the form and enables preview
  okBtn.addEventListener('click', () => {
    if (okBtn.disabled) return;
    formBox.classList.remove('hidden');
    formBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('title')?.focus();
    const previewBtn = document.getElementById('previewEvent');
    previewBtn.disabled = false;
    previewBtn.classList.remove('opacity-50');
    previewBtn.setAttribute('aria-disabled', 'false');
  });
});
