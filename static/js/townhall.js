// static/js/townhall.js
// Handles Firebase-authenticated Town Hall posts and response loading

console.log("📘 townhall.js loaded");

document.addEventListener("DOMContentLoaded", async () => {
  if (typeof firebase === "undefined" || !firebase.auth || !firebase.firestore) {
    console.error("❌ Firebase not fully loaded in townhall.js");
    return;
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  const form = document.getElementById("townhall-form");
  const input = document.getElementById("response-input");
  const list = document.getElementById("response-list");

  // Ensure only authenticated users can submit
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.warn("🔒 Must be signed in to submit. Redirecting...");
      window.location.href = "/login/?redirect=/townhall/";
      return;
    }

    console.log("👤 Logged in as:", user.email);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      const response = {
        text,
        uid: user.uid,
        displayName: user.displayName || "Anonymous",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      try {
        await db.collection("townhall_responses").add(response);
        console.log("✅ Response saved");
        input.value = "";
        prependResponse(response, true);
      } catch (err) {
        console.error("❌ Error submitting response:", err);
        alert("Failed to submit your response. Please try again.");
      }
    });

    // Load recent responses
    try {
      const snapshot = await db.collection("townhall_responses")
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

      list.innerHTML = ""; // Clear placeholder

      snapshot.forEach(doc => {
        prependResponse(doc.data(), false);
      });
    } catch (err) {
      console.error("❌ Error loading responses:", err);
    }
  });

  function prependResponse(data, isNew) {
    const entry = document.createElement("div");
    entry.className = `p-4 border rounded bg-gray-100 ${isNew ? "animate-pulse" : ""}`;
    entry.innerHTML = `
      <p class="font-semibold">${data.displayName || "Anonymous"}</p>
      <p class="text-gray-700 mt-1">${data.text}</p>
      <p class="text-xs text-gray-500 mt-2">${data.createdAt?.toDate?.().toLocaleString() || "Just now"}</p>
    `;
    list.prepend(entry);
  }
});
