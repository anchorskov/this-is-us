// jest.setup.cjs
// Global test-bootstrap: provides Node-ESM require(), polyfills browser-only
// APIs that JSDOM lacks (fetch, URL, Leaflet), and mocks front-end helpers
// so test files can import them safely.

/* ───────── 1 │ CommonJS require() inside ESM context ───────── */
const { createRequire } = require('module');
global.require = createRequire(__filename);

/* ───────── 2 │ Helper to build absolute paths (hoisted fn) ─── */
function fromRoot(rel) {
  return require('path').resolve(__dirname, rel);
}

/* ───────── 3 │ Browser-API polyfills / stubs ───────────────── */
const { TextEncoder, TextDecoder } = require('util');
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
if (!global.Response) {
  global.Response = class {
    constructor(body = null, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || 'OK';
      this.headers = init.headers || {};
    }
    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
    }
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }
  };
}

if (!global.Request) {
  global.Request = class {
    constructor(url, init = {}) {
      this.url = url;
      this.method = init.method || 'GET';
      this.headers = new Map(Object.entries(init.headers || {}));
      this.body = init.body;
    }
    async text() {
      return this.body;
    }
    async json() {
      return JSON.parse(this.body || '{}');
    }
  };
}

/* 3-a │ fetch – ZIP lookup & geocoder */
global.fetch = jest.fn((url) => {
  if (url.includes('api.zippopotam.us/us/90210')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        'post code': '90210',
        places: [{ 'place name': 'Beverly Hills', 'state abbreviation': 'CA' }],
      }),
    });
  }
  if (url.includes('nominatim.openstreetmap.org/search')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        { lat: '34.0522', lon: '-118.2437', display_name: 'Los Angeles' },
      ]),
    });
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
});

/* 3-b │ URL.createObjectURL / revokeObjectURL – PDF preview */
global.URL.createObjectURL = jest.fn(() => 'blob:mock-pdf-url');
global.URL.revokeObjectURL  = jest.fn();

/* 3-c │ Leaflet – chain-safe stub for map-init.js / event-map.js */
if (!global.L) {
  const spy = () => jest.fn();

  global.L = {
    map: jest.fn(() => {
      const m = {
        setView: spy(),
        on:      spy().mockReturnThis(),
        addLayer: spy(),
      };
      m.setView.mockReturnValue(m); // allow chaining
      return m;
    }),

    marker: jest.fn(() => ({
      addTo: spy(),
      on:    spy().mockReturnThis(),
    })),

    layerGroup: jest.fn(() => {
      const grp = {
        addTo:       spy().mockReturnThis(), // chainable
        clearLayers: spy(),
      };
      return grp;
    }),

    tileLayer: jest.fn(() => {
      const t = { addTo: spy() };
      t.addTo.mockReturnValue(t);
      return t;
    }),
  };
}

/* ───────── 4 │ Mock front-end helper modules ───────────────── */
jest.mock(fromRoot('static/js/events/form-state.js'), () => ({
  collectFormData: jest.fn(),
}));

jest.mock(fromRoot('static/js/events/submit-event.js'), () => ({
  submitEvent: jest.fn(),
}));

jest.mock(fromRoot('static/js/events/ui-feedback.js'), () => ({
  showToast:        jest.fn(),
  showSuccess:      jest.fn(),
  showError:        jest.fn(),
  toggleLoading:    jest.fn(),
  bindPdfPreview:   jest.fn(),
  showSuccessModal: jest.fn(),
}));

jest.mock(fromRoot('static/js/events/error-manager.js'), () => ({
  handleError: jest.fn(),
}));

jest.mock(fromRoot('static/js/events/preview-renderer.js'), () => ({
  renderPreview: jest.fn(),
}));
