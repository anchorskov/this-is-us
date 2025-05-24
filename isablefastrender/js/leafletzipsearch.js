export function createZipSearchBox(map, setMarker) {
  const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
  container.style.backgroundColor = 'white';
  container.style.padding = '8px';
  container.style.boxShadow = '0 0 6px rgba(0,0,0,0.2)';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Enter ZIP';
  input.style.width = '100px';
  input.style.marginRight = '6px';
  input.style.padding = '4px';

  const button = document.createElement('button');
  button.innerText = 'Zoom';
  button.style.padding = '4px 8px';

  container.appendChild(input);
  container.appendChild(button);

  L.Control.ZipSearch = L.Control.extend({
    onAdd: function () {
      return container;
    },
    onRemove: function () {}
  });

  L.control.zipSearch = function (opts) {
    return new L.Control.ZipSearch(opts);
  };

  L.control.zipSearch({ position: 'topright' }).addTo(map);

  L.DomEvent.disableClickPropagation(container);

  async function handleZipSearch() {
    const zip = input.value.trim();
    if (!zip || !/^\d{5}$/.test(zip)) {
      return alert("Please enter a valid 5-digit ZIP code.");
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zip)}`, {
        headers: {
          'User-Agent': 'this-is-us-events/1.0 (your-email@example.com)',
        }
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);

      const data = await res.json();
      if (!data.length) return alert("ZIP not found.");

      const { lat, lon } = data[0];
      setMarker(parseFloat(lat), parseFloat(lon));
    } catch (err) {
      console.error("ZIP lookup failed:", err);
      alert("ZIP lookup failed: " + err.message);
    }
  }

  button.addEventListener('click', handleZipSearch);

  // Autofill workaround: detect changes periodically
  let lastZip = "";
  setInterval(() => {
    const zip = input.value.trim();
    if (zip !== lastZip && /^\d{5}$/.test(zip)) {
      lastZip = zip;
      handleZipSearch();
    }
  }, 1000);
} 
