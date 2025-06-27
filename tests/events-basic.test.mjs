/* ------------------------------------------------------------------
   File: tests/events-basic.test.mjs
   Description: Smoke-tests key helpers for the event-creation workflow.
                • Validates ZIP-to-city/state autofill
                • Checks core validators (email, phone, date)
                • Confirms friendly error messages
                • Verifies full address search passes lat/lon to Leaflet
   ------------------------------------------------------------------ */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

/* ─── Modules under test ─────────────────────────────────────────── */
import { initAddressFields }   from '../static/js/events/create/address-fields.js';
import { initLeaflet }         from '../static/js/lib/map-init.js';
import { bindAddressSearch }   from '../static/js/events/event-map.js';
import {
  isValidEmail,
  isValidPhone,
  isFutureDate,
} from '../static/js/events/validation-utils.js';
import { getUserFriendlyError } from '../static/js/events/error-manager.js';

/* ─── Tiny DOM-event helpers ─────────────────────────────────────── */
const blur      = (el) => el.dispatchEvent(new Event('blur', { bubbles: true }));
const click     = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const nextMicro = ()  => new Promise(process.nextTick);   // wait one micro-tick

describe('Event-creation helpers (sanity checks)', () => {
  let mockMap, mockMarker;

  beforeEach(() => {
    /* Minimal DOM scaffold every test can share */
    document.body.innerHTML = `
      <!-- address-fields -->
      <input id="zip"   />
      <input id="city"  />
      <input id="state" />

      <!-- map search -->
      <input  id="address"        />
      <button id="searchAddress"></button>
      <div    id="map"></div>
    `;

    /* Fresh Leaflet instance mocks for each run */
    mockMap    = { setView: jest.fn() };
    mockMarker = { addTo: jest.fn(), on: jest.fn().mockReturnThis() };

    global.L.map.mockReturnValue(mockMap);
    global.L.marker.mockReturnValue(mockMarker);
  });

  /* ───────── address-fields.js ───────── */
  test('ZIP blur auto-fills city and state', async () => {
    initAddressFields();                       // attaches blur listener to #zip

    const zip   = document.getElementById('zip');
    const city  = document.getElementById('city');
    const state = document.getElementById('state');

    zip.value = '90210';
    blur(zip);                                 // triggers fetch (mocked)
    await nextMicro();                         // let promises resolve

    expect(city.value).toBe('Beverly Hills');
    expect(state.value).toBe('CA');
  });

  /* ───────── map-init / event-map.js ───────── */
  test('full address search passes correct lat/lon to Leaflet', async () => {
    // set up Leaflet helpers
    const { setMarker } = initLeaflet('#map');
    bindAddressSearch('#address', '#searchAddress', setMarker);

    document.getElementById('address').value = '123 Main St';
    click(document.getElementById('searchAddress'));

    await nextMicro();       // wait for mocked fetch → geocode promise

    const expectedLat = 34.0522;    // values from fetch mock in jest.setup.cjs
    const expectedLon = -118.2437;

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('nominatim.openstreetmap.org/search?'),
      expect.any(Object)
    );
    expect(global.L.marker).toHaveBeenCalledWith(
      [expectedLat, expectedLon],
      expect.any(Object)
    );
    expect(mockMap.setView).toHaveBeenCalledWith(
      [expectedLat, expectedLon],
      15
    );
  });

  /* ───────── validation-utils.js ──────── */
  test('validators recognise good / bad input', () => {
    expect(isValidEmail('good@example.com')).toBe(true);
    expect(isValidEmail('bad@')).toBe(false);

    expect(isValidPhone('+1 (555) 123-4567')).toBe(true);
    expect(isValidPhone('abc')).toBe(false);

    const future = new Date(Date.now() + 60_000).toISOString();
    const past   = new Date(Date.now() - 60_000).toISOString();
    expect(isFutureDate(future)).toBe(true);
    expect(isFutureDate(past)).toBe(false);
  });

  /* ───────── error-manager.js ─────────── */
  test('error codes map to friendly messages', () => {
    expect(getUserFriendlyError('DUPLICATE_PDF'))
      .toMatch(/already been submitted/i);

    expect(getUserFriendlyError('UNKNOWN_CODE', 'Custom fallback'))
      .toBe('Custom fallback');

    expect(getUserFriendlyError('UNKNOWN_CODE'))
      .toBe('Something went wrong. Please try again.');
  });
});
