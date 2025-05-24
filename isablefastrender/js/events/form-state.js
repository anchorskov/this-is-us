export function collectFormData() {
    const $ = id => document.getElementById(id);
    return {
      title: $("title").value.trim(),
      datetime: $("datetime").value,
      description: $("description").value.trim(),
      address: $("address").value.trim(),
      sponsor: $("sponsor").value.trim(),
      contactEmail: $("contactEmail").value.trim(),
      contactPhone: $("contactPhone").value.trim(),
      lat: $("lat").value,
      lng: $("lng").value,
      file: $("eventPdf").files[0]
    };
  }