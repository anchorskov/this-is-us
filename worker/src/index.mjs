// worker/src/index.mjs – central route map (updated 2025-11-07)

import { Router } from "itty-router";

/**
 * @typedef {import('@cloudflare/workers-types').D1Database} D1Database
 * @typedef {import('@cloudflare/workers-types').R2Bucket} R2Bucket
 *
 * @typedef Env
 * @property {D1Database} EVENTS_DB
 * @property {D1Database} BALLOT_DB
 * @property {D1Database} WY_DB
 * @property {R2Bucket}   EVENT_PDFS
 * @property {string}     FIREBASE_PROJECT_ID
 * @property {string}     FIREBASE_CLIENT_EMAIL
 * @property {string}     FIREBASE_PRIVATE_KEY
 */

/* ─────────── Feature handlers ─────────── */

// Events
import {
  handleListEvents,
  handleGetEventPdf,
  handleCreateEvent,
} from "./routes/events.js";

// Townhall
import { handleCreateTownhallPost } from "./townhall/createPost.js";
import { handleListTownhallPosts } from "./townhall/listPosts.js";
import { handleDeleteTownhallPost } from "./townhall/deletePost.js";
import {
  handleListTownhallThreads,
  handleCreateTownhallThread,
  handleGetTownhallThread,
  handleCreateTownhallReply,
} from "./routes/townhall/posts.mjs";

// Setup (seed topics, etc.)
import { register as registerSetup } from "./routes/setup.js";

// Sandbox & Debug
import { handleSandboxAnalyze } from "./routes/sandbox.js";

// Preferences & Topics
import { register as registerPreferences } from "./routes/preferences.js";
import { handlePreferencesRequest } from "./account/preferences.js";
import { handlePublicTopicIndex } from "./routes/topic-index.js";
import { handleTopicRequests } from "./account/topic-requests.js";
import userTopics from "./routes/api/user-topics/index.js"; // ⬅ NEW ROUTES
import { handleVoterLookup } from "./routes/voters.js";
import { handleGetCivicItem } from "./routes/civicItems.mjs";
import { handleOpenStatesSearch } from "./routes/openStatesSearch.mjs";
import {
  handlePendingBills,
  handlePendingBillsWithTopics,
} from "./routes/pendingBills.mjs";
import { handleBillSponsors } from "./routes/billSponsors.mjs";
import { handleInternalVerifyBill } from "./routes/internalVerifyBill.mjs";
import { handleDevLsoSync } from "./routes/devLsoSync.mjs";
import { handleDevSampleCompleteBills } from "./routes/devSampleCompleteBills.mjs";
import { handleListHotTopics, handleGetHotTopic } from "./routes/hotTopics.mjs";
import { handleVoteCivicItem } from "./routes/civicVotes.mjs";
import { handleScanPendingBills, handleTestOne, handleTestBillSummary } from "./routes/civicScan.mjs";
import { handleOpenAiSelfTest } from "./routes/openAiSelfTest.mjs";
import { handleFetchLsoText } from "./routes/fetchLsoText.mjs";
import { syncWyomingBills } from "./lib/openStatesSync.mjs";
import { handleDevLsoHydrate } from "./routes/devLsoHydrate.mjs";
import { runPendingBillsRefresh } from "./jobs/pendingBillsRefresh.mjs";
import { handleGetPodcastSummary } from "./routes/podcastSummary.mjs";

// Civic Watch – delegation lookup
import { handleGetDelegation } from "./routes/civic/delegation.mjs";

// User sync
import { handleSyncUser } from "./routes/sync-user.js";

// Shared CORS helper
import {
  handleCORSPreflight,
  handleRestrictedPreflight,
  TOWNHALL_ALLOWED_ORIGINS,
} from "./utils/cors.js";

// Stripe webhook handler
import handleStripeWebhook from "./stripe-webhook.js";

/* ─────────── Router setup ─────────── */
const router = Router();

/* Global CORS pre-flight */
router.options("/api/townhall/*", (req) =>
  handleRestrictedPreflight(req, TOWNHALL_ALLOWED_ORIGINS)
); // stricter origins for Town Hall writes
router.options("/api/*", handleCORSPreflight); // pre-flight for every API path
router.options("*", () => new Response(null, { status: 204 }));

/* Events */
router
  .get("/api/events", handleListEvents)
  .get("/api/events/pdf/:key", handleGetEventPdf)
  .post("/api/events/create", handleCreateEvent);

/* Townhall */
router
  .post("/api/townhall/create", handleCreateTownhallPost)
  .post("/api/townhall/posts", handleCreateTownhallThread)
  .get("/api/townhall/posts", handleListTownhallThreads)
  .get("/api/townhall/posts/:id", handleGetTownhallThread)
  .post("/api/townhall/posts/:id/replies", handleCreateTownhallReply)
  .post("/api/townhall/delete", handleDeleteTownhallPost);

/* Sandbox & debug */
router
  .get(
    "/api/_debug/schema",
    () =>
      new Response(
        JSON.stringify({ ok: true, message: "Debug schema route" }),
        { headers: { "Content-Type": "application/json" } }
      )
  )
  .post("/api/sandbox/analyze", handleSandboxAnalyze);

/* Preferences & topics */
registerPreferences(router); // OPTIONS + POST
router.get("/api/preferences", handlePreferencesRequest); // GET

/* User-topic checkbox routes */
router
  .get("/api/user-topics", userTopics.GET) // list user selections
  .post("/api/user-topics", userTopics.POST); // toggle selection

router.get("/api/civic/items/:id", handleGetCivicItem);
router.post("/api/civic/items/:id/vote", handleVoteCivicItem);
router.get("/api/civic/openstates/search", handleOpenStatesSearch);
router.get("/api/civic/pending-bills", handlePendingBills);
router.get("/api/civic/pending-bills-with-topics", handlePendingBillsWithTopics);
router.get("/api/civic/bill-sponsors", handleBillSponsors);
router.get("/api/civic/delegation", handleGetDelegation);
router.get("/api/internal/civic/verify-bill", handleInternalVerifyBill);
router.post("/api/internal/civic/fetch-lso-text", handleFetchLsoText);
router.post("/api/dev/lso/hydrate-bills", handleDevLsoHydrate);

// Test routes (Milestones 1–2)
router.get("/api/internal/civic/test-one", handleTestOne);
router.post("/api/internal/civic/test-one", handleTestOne);

// Test bill summary route
router.post("/api/internal/civic/test-bill-summary", handleTestBillSummary);

// Production scan route (Milestone 4)
router.post("/api/internal/civic/scan-pending-bills", handleScanPendingBills);

// OpenAI API key self-test (dev only)
router.get("/api/internal/openai-self-test", handleOpenAiSelfTest);

// Podcast summary – dual routes to handle routing edge cases
router.get("/api/podcast/summary", handleGetPodcastSummary);
router.get("/podcast/summary", handleGetPodcastSummary);

// Debug endpoint – list all registered routes (dev only)
router.get("/api/_routes", (req, env) => {
  const host = new URL(req.url).hostname;
  const isLocal = host === "127.0.0.1" || host === "localhost";
  if (!isLocal) {
    return new Response(
      JSON.stringify({ error: "Not available outside dev" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({
      message: "Registered routes (debug)",
      routes: [
        "GET /api/events",
        "GET /api/events/pdf/:key",
        "POST /api/events/create",
        "POST /api/townhall/create",
        "POST /api/townhall/posts",
        "GET /api/townhall/posts",
        "GET /api/townhall/posts/:id",
        "POST /api/townhall/posts/:id/replies",
        "POST /api/townhall/delete",
        "GET /api/_debug/schema",
        "POST /api/sandbox/analyze",
        "GET /api/preferences",
        "GET /api/user-topics",
        "POST /api/user-topics",
        "GET /api/civic/items/:id",
        "POST /api/civic/items/:id/vote",
        "GET /api/civic/openstates/search",
        "GET /api/civic/pending-bills",
        "GET /api/civic/pending-bills-with-topics",
        "GET /api/civic/bill-sponsors",
        "GET /api/civic/delegation",
        "GET /api/internal/civic/verify-bill",
        "POST /api/internal/civic/fetch-lso-text",
        "POST /api/dev/lso/hydrate-bills",
        "GET /api/internal/civic/test-one",
        "POST /api/internal/civic/test-one",
        "POST /api/internal/civic/test-bill-summary",
        "POST /api/internal/civic/scan-pending-bills",
        "GET /api/internal/openai-self-test",
        "GET /api/podcast/summary",
        "GET /podcast/summary",
        "GET /api/_routes",
        "GET /api/_health"
      ]
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});

// DEV ONLY sync route for OpenStates bills into civic_items (uses WY_DB)
router.get("/api/dev/openstates/sync", async (req, env) => {
  const host = new URL(req.url).hostname;
  const isLocal = host === "127.0.0.1" || host === "localhost";
  if (!isLocal) {
    return new Response(
      JSON.stringify({ error: "Not available outside dev" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  const url = new URL(req.url);
  const session = url.searchParams.get("session");
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);
  try {
    const result = await syncWyomingBills(env, env.WY_DB, {
      session,
      limit,
    });
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ dev sync error:", err);
    return new Response(
      JSON.stringify({ error: "sync failed", message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// DEV ONLY: Sync LSO committee bills
router.get("/api/dev/lso/sync-committee-bills", async (req, env) => {
  const host = new URL(req.url).hostname;
  const isLocal = host === "127.0.0.1" || host === "localhost";
  if (!isLocal) {
    return new Response(
      JSON.stringify({ error: "Not available outside dev" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  const url = new URL(req.url);
  const year = url.searchParams.get("year") || new Date().getFullYear();
  try {
    const result = await handleDevLsoSync(req, env);
    return result;
  } catch (err) {
    console.error("❌ dev LSO sync error:", err);
    return new Response(
      JSON.stringify({ error: "lso_sync_failed", message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// DEV ONLY: sample complete civic items
router.get("/api/dev/civic/sample-complete-bills", async (req, env) => {
  const host = new URL(req.url).hostname;
  const isLocal = host === "127.0.0.1" || host === "localhost";
  if (!isLocal) {
    return new Response(
      JSON.stringify({ error: "Not available outside dev" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  return handleDevSampleCompleteBills(req, env);
});

registerSetup(router); // mounts /api/setup/topics
router.get("/api/topic-index", handlePublicTopicIndex);
router
  .get("/api/topic-requests", handleTopicRequests)
  .post("/api/topic-requests", handleTopicRequests)
  .post("/api/sync-user", handleSyncUser);

router.get("/api/voters/lookup", handleVoterLookup);

/* Hot Topics */
router
  .get("/api/hot-topics", handleListHotTopics)
  .get("/api/hot-topics/:slug", handleGetHotTopic);

/* Stripe webhook */
router.post("/api/stripe-webhook", handleStripeWebhook);

/* Health & fallback */
router.all("/api/_health", () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  })
);

router.all("*", () => new Response("Not found", { status: 404 }));

/* ─────────── Worker export ─────────── */
export default {
  async fetch(request, env, ctx) {
    const res = await router.fetch(request, env, ctx);
    const headers = new Headers(res.headers);

    // ensure CORS headers are present on *every* response
    if (!headers.has("Access-Control-Allow-Origin")) {
      headers.set("Access-Control-Allow-Origin", "*");
    }

    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Stripe-Signature"
    );

    return new Response(res.body, { status: res.status, headers });
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      (async () => {
        try {
          const result = await runPendingBillsRefresh(env);
          console.log(
            "⏰ pending-bills cron complete:",
            JSON.stringify(
              {
                ingest: result.ingest?.count ?? null,
                scan: result.scan?.scanned ?? null,
                skipped: result.scan?.skipped ?? false,
              },
              null,
              2
            )
          );
        } catch (err) {
          console.error("❌ pending-bills cron failed:", err);
        }
      })()
    );
  },
};
