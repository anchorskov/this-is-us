// worker/src/index.mjs – central route map (updated 2025-11-07)

import { Router } from "itty-router";

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

// User sync
import { handleSyncUser } from "./routes/sync-user.js";

// Shared CORS helper
import { handleCORSPreflight } from "./utils/cors.js";

// Stripe webhook handler
import handleStripeWebhook from "./stripe-webhook.js";

/* ─────────── Router setup ─────────── */
const router = Router();

/* Global CORS pre-flight */
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
  .get("/api/townhall/posts", handleListTownhallPosts)
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

registerSetup(router); // mounts /api/setup/topics
router.get("/api/topic-index", handlePublicTopicIndex);
router
  .get("/api/topic-requests", handleTopicRequests)
  .post("/api/topic-requests", handleTopicRequests)
  .post("/api/sync-user", handleSyncUser);

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
    /* cron jobs */
  },
};
