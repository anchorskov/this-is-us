// static/js/townhall/load-dynamic-thread.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Replace with your actual config if not globally injected
const firebaseConfig = window.firebaseConfig;
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get thread ID from URL
const pathParts = window.location.pathname.split('/');
const threadId = pathParts[pathParts.length - 1];

const container = document.getElementById("dynamic-thread");

async function loadThread() {
  try {
    const docRef = doc(db, "townhallThreads", threadId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      container.innerHTML = "<p class='text-red-500 text-center'>Thread not found.</p>";
      return;
    }

    const thread = docSnap.data();
    container.innerHTML = `
      <article class="prose lg:prose-xl">
        <h1>${thread.title || "Untitled"}</h1>
        <p class="text-sm text-gray-500">Posted on ${thread.date || "Unknown date"}</p>
        ${thread.author ? `<p class="text-sm text-gray-600">By ${thread.author}</p>` : ""}
        <div>${thread.content || "(no content)"}</div>
        ${Array.isArray(thread.tags) && thread.tags.length > 0
          ? `<p class="mt-4 text-sm text-blue-700">Tags: ${thread.tags.map(tag => `<span class="bg-blue-100 px-2 py-1 rounded mr-2">${tag}</span>`).join(' ')}</p>`
          : ""
        }
      </article>
    `;
  } catch (err) {
    container.innerHTML = `<p class="text-red-600">Error loading thread: ${err.message}</p>`;
  }
}

loadThread();
