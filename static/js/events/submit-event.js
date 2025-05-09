import { showSuccess, showError, toggleLoading } from './ui-feedback.js';

export async function submitEvent(formDataCache) {
  toggleLoading(true, "#confirmSubmit");

  try {
    const formData = new FormData();
    for (const key in formDataCache) {
      formData.append(key, formDataCache[key]);
    }

    const res = await fetch("/api/events/create", {
      method: "POST",
      body: formData
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Submission failed");

    showSuccess("✅ Event submitted successfully!");
    return { ok: true };
  } catch (err) {
    showError(err);
    return { ok: false, error: err };
  } finally {
    toggleLoading(false, "#confirmSubmit");
  }
}
