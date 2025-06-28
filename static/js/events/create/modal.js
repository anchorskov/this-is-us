/* static/js/events/create/modal.js */
export function showSuccess(id = '') {
  const modal = document.getElementById('successModal');
  if (!modal) return;

  // Optional: inject a link to the newly-created event
  if (id) {
    modal.querySelector('#viewEventBtn')
         .setAttribute('href', `/events/${id}/`);
  }

  modal.classList.remove('hidden');          // make it visible
  modal.removeAttribute('aria-hidden');

  // simple close handler
  modal.querySelector('#okEventBtn')
       .addEventListener('click', () => modal.classList.add('hidden'), { once:true });
}
