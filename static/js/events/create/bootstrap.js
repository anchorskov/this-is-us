// static/js/events/create/bootstrap.js
import { initLeaflet }         from '../../lib/map-init.js';
import { bindAddressSearch }   from '../event-map.js';
import { initAddressFields }   from './address-fields.js';
import { getUserZip }          from '../../lib/firestore-profile.js';
import geocode                 from '../../lib/geocode.js';
import { renderForm }          from '../event-form.js'; 
(async function () {
  /* 1️⃣ wait for Firebase auth */
  await firebase.auth().authStateReady;
  const uid = firebase.auth().currentUser?.uid || null;
  const db  = firebase.firestore();

  /* 2️⃣ fetch saved ZIP (if any) */
  const savedZip = await getUserZip(db, uid);

  /* 3️⃣ initialise Leaflet */
  const { setMarker, setView } = initLeaflet('#map');

  /* 4️⃣ zoom to saved ZIP or leave default view */
  if (savedZip) {
    const hit = await geocode(savedZip);
    if (hit) setView(hit.lat, hit.lon, 12);
  }

  /* 5️⃣ bind the map search button */
  bindAddressSearch('#address', '#searchAddress', setMarker);

  /* 6️⃣ initialise ZIP → city/state auto-fill */
  initAddressFields();

    /* 7️⃣ build the event form once user is ready */
  renderForm(firebase.auth().currentUser);
})();
