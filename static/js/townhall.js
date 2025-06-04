// static/js/townhall.js
// Handles Firebase-authenticated Town Hall posts via Cloudflare D1 and R2
console.log("📘 townhall.js loaded");

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof firebase === "undefined" || !firebase.auth) {
    console.error("❌ Firebase Auth not loaded");
    return;
  }

  const auth = firebase.auth();
  const form = document.getElementById("townhall-form");
  const input = document.getElementById("response-input");
  const fileInput = document.getElementById("response-file");
  const list = document.getElementById("response-list");
  const loginWarning = document.getElementById("login-warning");
  const promptHeader = document.getElementById("townhall-prompt-header");
  const promptBody = document.getElementById("townhall-prompt");

  const base = window.location.hostname === 'localhost'
    ? 'http://localhost:8787/api'
    : '/api';

  if (loginWarning) loginWarning.classList.add("hidden");

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.warn("🔒 Must be signed in to submit. Redirecting...");
      if (loginWarning) loginWarning.classList.remove("hidden");
      return window.location.href = "/login/?redirect=/townhall/";
    }

    console.log("👤 Logged in as:", user.email);

    // 🧠 Personalize prompt
    const name = user.displayName || user.email?.split("@")[0] || "friend";
    if (promptHeader) promptHeader.textContent = `What’s on your mind, ${name}?`;
    if (promptBody) promptBody.textContent = "This space is yours—share your thoughts or questions.";

    if (loginWarning) loginWarning.classList.add("hidden");
    if (form) form.classList.remove("hidden");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      const payload = new FormData();
      payload.append("user_id", user.uid);
      payload.append("title", "User Submission");
      payload.append("prompt", text);

      const file = fileInput?.files?.[0];
      if (file && file.type === "application/pdf" && file.size <= 2 * 1024 * 1024) {
        payload.append("file", file);
      } else if (file) {
        alert("File must be a PDF under 2MB.");
        return;
      }

      try {
        const res = await fetch(`${base}/townhall/create`, {
          method: "POST",
          body: payload
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Unknown error");

        console.log("✅ Response saved", result);
        input.value = "";
        if (fileInput) fileInput.value = "";
        fetchResponses();
      } catch (err) {
        console.error("❌ Error submitting response:", err);
        alert("Failed to submit your response. Please try again.");
      }
    });

    fetchResponses();
  });

  async function fetchResponses() {
    try {
      const res = await fetch(`${base}/townhall/posts`);
      const results = await res.json();

      list.innerHTML = "";
      if (!results.length) {
        list.innerHTML = `<p class="text-gray-500 italic">No responses yet. Be the first to speak.</p>`;
        return;
      }

      results.forEach(post => prependResponse(post));
    } catch (err) {
      console.error("❌ Error loading responses:", err);
    }
  }

  function prependResponse(data) {
    const entry = document.createElement("div");
    entry.className = "p-4 border rounded bg-gray-100";
    entry.innerHTML = `
      <p class="font-semibold">${data.user_id || "Anonymous"}</p>
      <p class="text-gray-700 mt-1">${data.prompt}</p>
      <p class="text-xs text-gray-500 mt-2">${new Date(data.created_at).toLocaleString()}</p>
      ${data.r2_key ? `<a href="/api/events/pdf/${data.r2_key}" class="text-blue-600 text-sm mt-2 block">📎 View PDF</a>` : ""}
    `;
    list.prepend(entry);
  }
});
