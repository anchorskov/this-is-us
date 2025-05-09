// static/js/events/event-form.js
import { submitEvent } from './submit-event.js';
import { initMap, bindAddressSearch } from './event-map.js';
import { bindPdfPreview, showSuccess, showError, toggleLoading } from './ui-feedback.js';
import { isValidEmail, isValidPhone, isFutureDate, areRequiredFieldsPresent } from './validation-utils.js';

let formDataCache = {};

export function renderForm(user) {
  const container = document.querySelector("#event-form");
  if (!container) return;
  container.innerHTML = getFormHTML();

  const successBox = document.querySelector("#success-message");
  if (successBox) successBox.style.display = "none";

  const { setMarker } = initMap();
  bindAddressSearch(setMarker);
  bindPdfPreview();
  bindFormLogic(user);
}

function getFormHTML() {
  return `
    <div class="w-100 flex items-center justify-center pa5" style="background-color: #f7f7f7;">
      <div class="w-100 w-90-m w-80-l mw6 pa4 br3 shadow-1 bg-white">
        <h2 class="f3 fw6 tc mb4">Create an Event</h2>
        <form id="eventForm" class="flex flex-column">
          <label for="title" class="db mb2 fw6">Event Title</label>
          <input type="text" id="title" required class="input-reset ba b--black-20 pa2 mb3 w-100">

          <label for="datetime" class="db mb2 fw6">Event Date & Time</label>
          <input type="datetime-local" id="datetime" required class="input-reset ba b--black-20 pa2 mb3 w-100">

          <label for="description" class="db mb2 fw6">Description</label>
          <textarea id="description" required class="input-reset ba b--black-20 pa2 mb3 w-100" rows="4"></textarea>

          <label for="address" class="db mb2 fw6">Event Address or ZIP Code</label>
          <input type="text" id="address" class="input-reset ba b--black-20 pa2 w-100 mb2">
          <button type="button" id="searchAddress" class="f6 link dim br2 ph3 pv2 mb3 dib white bg-dark-blue w-100">🔍 Search Address</button>

          <label for="sponsor" class="db mb2 fw6">Sponsoring Organization (optional)</label>
          <input type="text" id="sponsor" class="input-reset ba b--black-20 pa2 mb3 w-100">

          <label for="contactEmail" class="db mb2 fw6">Contact Email (optional)</label>
          <input type="email" id="contactEmail" class="input-reset ba b--black-20 pa2 mb3 w-100">

          <label for="contactPhone" class="db mb2 fw6">Contact Phone (optional)</label>
          <input type="tel" id="contactPhone" class="input-reset ba b--black-20 pa2 mb3 w-100">

          <div id="map" class="br2 mb2" style="height: 300px; border: 1px solid #ccc;"></div>
          <p id="locationConfirmation" class="mt2 f6 dark-gray"></p>

          <label for="eventPdf" class="db mb2 fw6">Attach PDF Flyer</label>
          <input type="file" id="eventPdf" accept="application/pdf" class="input-reset ba b--black-20 pa2 mb3 w-100">
          <iframe id="pdfPreview" class="mb3" style="width:100%; height:300px; border:1px solid #ddd; display:none;"></iframe>

          <input type="hidden" id="lat"><input type="hidden" id="lng">

          <button type="button" id="previewEvent" class="f5 link dim br3 ph3 pv3 mb2 dib white bg-green w-100">Next → Preview</button>
        </form>

        <div id="success-message" class="dn tc bg-washed-green dark-green pa3 br3 mt3">✅ Event submitted successfully!</div>
        <div id="event-preview" class="dn mt4"></div>
      </div>
    </div>`;
}

function bindFormLogic(user) {
  const form = document.querySelector("#eventForm");
  const previewBtn = document.querySelector("#previewEvent");

  previewBtn.addEventListener("click", () => {
    const $ = id => document.getElementById(id);

    const values = {
      title: $("title").value.trim(),
      datetime: $("datetime").value,
      description: $("description").value.trim(),
      address: $("address").value.trim(),
      sponsor: $("sponsor").value.trim(),
      contactEmail: $("contactEmail").value.trim(),
      contactPhone: $("contactPhone").value.trim(),
      lat: $("lat").value,
      lng: $("lng").value,
      file: $("eventPdf").files[0],
    };

    if (!areRequiredFieldsPresent([values.title, values.datetime, values.description, values.lat, values.lng]) || !values.file) {
      return showError("Please complete all required fields.");
    }

    // Convert to UTC for precision
    const eventDateUTC = new Date(values.datetime).toISOString();
    if (!isFutureDate(eventDateUTC)) return showError("Date must be in future.");

    if (values.contactEmail && !isValidEmail(values.contactEmail)) return showError("Invalid email.");
    if (values.contactPhone && !isValidPhone(values.contactPhone)) return showError("Invalid phone.");

    formDataCache = { ...values, datetime: eventDateUTC, userId: user.uid };
    renderPreview(formDataCache);
    form.style.display = "none";
    document.querySelector("#event-preview").style.display = "block";
  });
}

function renderPreview(data) {
    const container = document.querySelector("#event-preview");
  
    const formattedDate = new Date(data.datetime).toLocaleString(undefined, {
      timeZoneName: 'short'
    });
  
    const flyerURL = data.file ? URL.createObjectURL(data.file) : "";
  
    container.innerHTML = `
      <div class="bg-light-gray pa3 br3 shadow-1">
        <h3 class="f4">Preview Your Event</h3>
        <p><strong>Title:</strong> ${data.title}</p>
        <p><strong>Date & Time:</strong> ${formattedDate}</p>
        <p><strong>Description:</strong> ${data.description}</p>
        <p><strong>Address:</strong> ${data.address}</p>
        ${data.sponsor ? `<p><strong>Sponsor:</strong> ${data.sponsor}</p>` : ""}
        ${data.contactEmail ? `<p><strong>Email:</strong> ${data.contactEmail}</p>` : ""}
        ${data.contactPhone ? `<p><strong>Phone:</strong> ${data.contactPhone}</p>` : ""}
        <div class="mt3">
          <p><strong>Flyer Preview:</strong></p>
          <iframe style="width:100%; height:300px; border:1px solid #ddd;" src="${flyerURL}"></iframe>
        </div>
        <div class="mt3 flex justify-between">
          <button id="cancelPreview" class="f6 br2 ph3 pv2 dib bg-light-red white">✖ Cancel</button>
          <button id="editForm" class="f6 br2 ph3 pv2 dib bg-mid-gray white">← Back to Edit</button>
          <button id="confirmSubmit" class="f6 br2 ph3 pv2 dib bg-green white">✅ Confirm & Submit</button>
        </div>
      </div>
    `;
  
    document.getElementById("cancelPreview").onclick = () => {
      document.querySelector("#eventForm").style.display = "block";
      document.querySelector("#event-preview").style.display = "none";
    };
  
    document.getElementById("editForm").onclick = () => {
      document.querySelector("#eventForm").style.display = "block";
      document.querySelector("#event-preview").style.display = "none";
  
      // Restore map zoom and marker
      if (window._leafletMap && window._markerGroup && data.lat && data.lng) {
        const lat = parseFloat(data.lat);
        const lng = parseFloat(data.lng);
        window._markerGroup.clearLayers();
        L.marker([lat, lng]).addTo(window._markerGroup);
        window._leafletMap.setView([lat, lng], 14);
      }
    };
  
    document.getElementById("confirmSubmit").onclick = async () => {
      const submitBtn = document.getElementById("confirmSubmit");
      submitBtn.disabled = true;
      toggleLoading(true, "#confirmSubmit");
  
      try {
        // 🔎 Duplicate check before actual submission
        const existsRes = await fetch(`/api/events/check-duplicate?title=${encodeURIComponent(data.title)}&datetime=${encodeURIComponent(data.datetime)}`);
        const exists = await existsRes.json();
  
        if (exists?.duplicate) {
          showError("⚠️ This event is already scheduled.");
          submitBtn.disabled = false;
          toggleLoading(false, "#confirmSubmit");
          return;
        }
  
        const result = await submitEvent(formDataCache);
        if (result.ok) {
          showSuccess("🎉 Event has been scheduled!");
          document.getElementById("pdfPreview").style.display = "none";
          document.querySelector("#eventForm").reset();
          document.querySelector("#eventForm").style.display = "block";
          document.querySelector("#event-preview").style.display = "none";
  
          if (window._leafletMap) {
            window._leafletMap.setView([39.5, -98.35], 4);
            if (window._markerGroup) window._markerGroup.clearLayers();
          }
        }
      } catch (err) {
        showError("❌ Submission failed: " + err.message);
        submitBtn.disabled = false;
      } finally {
        toggleLoading(false, "#confirmSubmit");
      }
    };
  }
  
  