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
  
    // Prevent map drag when interacting with the control
    L.DomEvent.disableClickPropagation(container);
  
    button.addEventListener('click', async () => {
      const zip = input.value.trim();
      if (!zip) return alert("Please enter a ZIP code.");
  
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zip)}`);
        const data = await res.json();
        if (!data.length) return alert("ZIP not found.");
        const { lat, lon } = data[0];
        setMarker(parseFloat(lat), parseFloat(lon));
      } catch (err) {
        alert("ZIP lookup failed: " + err.message);
      }
    });
  }
  