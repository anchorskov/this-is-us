navigator.geolocation.getCurrentPosition(pos => {
  const { latitude, longitude } = pos.coords;
  initMap(latitude, longitude);
}, err => {
  alert("Location access denied. Please allow location to see nearby events.");
});
