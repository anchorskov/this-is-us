// static/js/events/create/address-fields.js
import { getCityState } from '../../lib/zip-info.js';

export function initAddressFields() {
  const zipIn   = document.getElementById('zip');
  const cityIn  = document.getElementById('city');
  const stateIn = document.getElementById('state');

  if (!zipIn || !cityIn || !stateIn) return;

  zipIn.addEventListener('blur', async () => {
    const z = zipIn.value.trim();
    const hit = await getCityState(z);
    if (hit) {
      cityIn.value  = hit.city;
      stateIn.value = hit.state;
      document.dispatchEvent(new Event('addressReady'));
    }
  });
}
