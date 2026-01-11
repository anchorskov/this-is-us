import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { apiRoot } from "/js/lib/api-root.js";

async function loadHotTopics() {
  const container = document.getElementById("hotTopicsList");
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const debug = urlParams.get("debug") === "1";
  const session = urlParams.get("session") || "2026";

  const apiBase = apiRoot();

  if (debug) {
    console.log("[HOT_TOPICS_FRONTEND_DEBUG] API base:", apiBase);
  }

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
    const query = new URLSearchParams();
    if (debug) query.set("debug", "1");
    if (session) query.set("session", session);
    const apiUrl = `${apiBase}/hot-topics${query.toString() ? `?${query.toString()}` : ""}`;
    if (debug) {
      console.log("[HOT_TOPICS_FRONTEND_DEBUG] Fetching from:", apiUrl);
    }

    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error("Failed to fetch topics");

    const data = await response.json();
    const topics = data.results || data;

    if (debug) {
      console.log("[HOT_TOPICS_FRONTEND_DEBUG] API response:", data);
      console.log("[HOT_TOPICS_FRONTEND_DEBUG] Topics array:", topics);
      if (Array.isArray(topics) && topics.length > 0) {
        console.log("[HOT_TOPICS_FRONTEND_DEBUG] First topic structure:", topics[0]);
      }
    }

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
        const badgeLabel = topic.badge || "Topic";
        const badgeClass = badgeLabel.toLowerCase().replace(/[\s&]/g, "");
        const bills = Array.isArray(topic.top_bills)
          ? topic.top_bills
          : Array.isArray(topic.civic_items)
          ? topic.civic_items
          : [];
        const civicCount =
          typeof topic.bill_count === "number" ? topic.bill_count : bills.length;
        const isFollowed = followedTopicIds.includes(topic.id);
        const followedBadge = isFollowed 
          ? '<span class="followed-badge" title="You follow this topic">★ Following</span>' 
          : '';
        const billList = bills.length
          ? `<ul class="bill-list">
              ${bills
                .slice(0, 3)
                .map((bill) => {
                  const link = bill.text_url || bill.external_url || "#";
                  const summary = truncate(bill.ai_summary || "", 140);
                  const linkAttrs = link === "#" ? "" : ' target="_blank" rel="noopener"';
                  return `
                    <li>
                      <a href="${link}" class="bill-link"${linkAttrs}>
                        ${bill.bill_number || "Bill"} — ${bill.title || "Untitled"}
                      </a>
                      ${summary ? `<div class="bill-summary">${summary}</div>` : ""}
                    </li>
                  `;
                })
                .join("")}
            </ul>`
          : '<div class="bill-empty">No linked bills yet.</div>';
        
        if (debug) {
          console.log(`[HOT_TOPICS_FRONTEND_DEBUG] Topic: ${topic.title}, civic_items length: ${civicCount}, civic_items:`, topic.civic_items);
        }

        const topicUrl = `/hot-topics/${topic.slug}`;
        return `
          <div class="hot-topic-card ${isFollowed ? 'followed' : ''}">
            <span class="badge ${badgeClass}">${badgeLabel}</span>
            ${followedBadge}
            <h3><a class="topic-link" href="${topicUrl}">${topic.title}</a></h3>
            <p class="summary">${truncate(topic.summary || "", 150)}</p>
            <div class="card-footer">
              <span class="bill-count">
                <strong>${civicCount}</strong> bill${civicCount !== 1 ? "s" : ""}
              </span>
              <a class="cta-button" href="${topicUrl}">${topic.cta_label || "View"}</a>
            </div>
            ${billList}
          </div>
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
