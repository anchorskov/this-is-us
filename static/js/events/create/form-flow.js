// static/js/events/create/form-flow.js
// 1) focus helper for Date-picker
document.addEventListener('DOMContentLoaded', () => {
  const doneBtn   = document.getElementById('confirmDateTime');
  const nextField = document.getElementById('description');
  doneBtn?.addEventListener('click', () => nextField?.focus());
});

// 2) Location → enable OK button
document.addEventListener('DOMContentLoaded', () => {
  const okBtn   = document.getElementById('loc-ok');     // green OK button
  const formBox = document.getElementById('event-form'); // wrapper that starts hidden

  if (!okBtn || !formBox) return;

  /* Enable the OK button when a marker is set */
  document.addEventListener('locationSet', () => {
    okBtn.disabled = false;
    okBtn.classList.remove('opacity-50');
    okBtn.setAttribute('aria-disabled', 'false');
    okBtn.focus();                        // visual cue
  });

  /* When OK is clicked, reveal the form and focus Title */
  okBtn.addEventListener('click', () => {
    if (okBtn.disabled) return;           // safety guard
    formBox.classList.remove('hidden');
    formBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('title')?.focus();
    // ✅ enable the Preview button now that a location is confirmed
    const previewBtn = document.getElementById('previewEvent');
    previewBtn.disabled = false;
    previewBtn.classList.remove('opacity-50');
    previewBtn.setAttribute('aria-disabled', 'false');
    });
});
