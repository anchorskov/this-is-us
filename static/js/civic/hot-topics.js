import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

async function loadHotTopics() {
  const container = document.getElementById("hotTopicsList");
  if (!container) return;

  const apiBase = window.EVENTS_API_READY
    ? await window.EVENTS_API_READY
    : window.EVENTS_API_URL || "/api";

  // Get followed topics from Firebase
  let followedTopicIds = [];
  const auth = getAuth();
  try {
    await new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          const db = getFirestore();
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists() && userDocSnap.data().preferences?.followedTopics) {
            followedTopicIds = userDocSnap.data().preferences.followedTopics;
          }
        }
        resolve();
      });
    });
  } catch (err) {
    console.warn("Could not load followed topics:", err);
  }

  try {
    const response = await fetch(`${apiBase}/hot-topics`);
    if (!response.ok) throw new Error("Failed to fetch topics");

    const data = await response.json();
    const topics = data.results || data;

    if (!Array.isArray(topics) || topics.length === 0) {
      container.innerHTML = '<div class="error">No topics available.</div>';
      return;
    }

    // Sort followed topics to the top
    const sortedTopics = topics.sort((a, b) => {
      const aFollowed = followedTopicIds.includes(a.id);
      const bFollowed = followedTopicIds.includes(b.id);
      if (aFollowed && !bFollowed) return -1;
      if (!aFollowed && bFollowed) return 1;
      return 0;
    });

    container.innerHTML = sortedTopics
      .map((topic) => {
        const badgeClass = topic.badge
          ? topic.badge.toLowerCase().replace(/[\s&]/g, "")
          : "";
        const civicCount = (topic.civic_items || []).length;
        const isFollowed = followedTopicIds.includes(topic.id);
        const followedBadge = isFollowed 
          ? '<span class="followed-badge" title="You follow this topic">★ Following</span>' 
          : '';
        
        return `
          <a href="/hot-topics/${topic.slug}" class="hot-topic-card ${isFollowed ? 'followed' : ''}">
            <span class="badge ${badgeClass}">${topic.badge}</span>
            ${followedBadge}
            <h3>${topic.title}</h3>
            <p class="summary">${truncate(topic.summary || "", 150)}</p>
            <div class="card-footer">
              <span class="bill-count">
                <strong>${civicCount}</strong> bill${civicCount !== 1 ? "s" : ""}
              </span>
              <button class="cta-button">${topic.cta_label || "View"}</button>
            </div>
          </a>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Error loading topics:", error);
    container.innerHTML =
      '<div class="error">Error loading topics. Please try again.</div>';
  }
}

function truncate(str, maxLen) {
  return str.length > maxLen ? str.substring(0, maxLen) + "..." : str;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadHotTopics);
} else {
  loadHotTopics();
}
