// ui-feedback.js

export function showSuccess(message = "Event submitted successfully!") {
    showToast(message, "success");
  }
  
  export function showError(err) {
    const message = err?.message || err || "Something went wrong";
    console.error("❌", message);
    showToast(message, "error");
    // Optional fallback:
    // alert("Error: " + message);
  }
  
  export function toggleLoading(isLoading, buttonSelector = "#eventForm button[type='submit']") {
    const btn = document.querySelector(buttonSelector);
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading
      ? `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting…`
      : "📤 Submit Event";
  }
  
  // 🍞 Toast feedback utility
  export function showToast(message, type = "info", duration = 4000) {
    let container = document.getElementById("toast-container");
  
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }
  
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
  
    container.appendChild(toast);
  
    setTimeout(() => {
      toast.remove();
      if (!container.hasChildNodes()) {
        container.remove();
      }
    }, duration);
  }
  export function bindPdfPreview() {
    const input = document.getElementById("eventPdf");
    const iframe = document.getElementById("pdfPreview");
  
    if (!input || !iframe) return;
  
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (file && file.type === "application/pdf") {
        iframe.src = URL.createObjectURL(file);
        iframe.style.display = "block";
      } else {
        iframe.src = "";
        iframe.style.display = "none";
      }
    });
  }
  