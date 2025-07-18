// worker/src/index.mjs – central route map (updated 2025‑07‑17)
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
import { register as registerPreferences } from "./routes/preferences.js"; // This imports the register function
import { handlePreferencesRequest } from "./account/preferences.js"; // Import the handler directly for GET
import { handlePublicTopicIndex } from "./routes/topic-index.js";
import { handleTopicRequests } from "./account/topic-requests.js";

// User sync
import { handleSyncUser } from "./routes/sync-user.js";

// Shared CORS helper
import { handleCORSPreflight } from "./utils/cors.js";

/* ─────────── Router setup ─────────── */
const router = Router();

/* Global CORS pre‑flight */
router.options("*", handleCORSPreflight);

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
  .get("/api/_debug/schema", () => new Response(JSON.stringify({ ok: true, message: "Debug schema route" }), { headers: { 'Content-Type': 'application/json' } })) // Added JSON response
  .post("/api/sandbox/analyze", handleSandboxAnalyze);

/* Preferences & topics */
// Register preferences routes (OPTIONS and POST)
registerPreferences(router); 
// Explicitly add the GET route for preferences, mapping to the same handler
router.get("/api/preferences", handlePreferencesRequest); // <--- ADDED THIS LINE FOR GET REQUESTS

registerSetup(router); // mounts /api/setup/topics
router.get("/api/topic-index", handlePublicTopicIndex);
router
  .get("/api/topic-requests", handleTopicRequests)
  .post("/api/topic-requests", handleTopicRequests)
  .post("/api/sync-user", handleSyncUser);

/* Health & fallback */
router.get("/api/_health", () => new Response(JSON.stringify({ ok: true })));
router.all("*", () => new Response("Not found", { status: 404 }));

/* ─────────── Worker export ─────────── */
export default {
  async fetch(request, env, ctx) {
    const res = await router.fetch(request, env, ctx);
    // Ensure all responses from the router have CORS headers
    // The `json` helper already does this, but this is a fallback for non-json responses or errors.
    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return new Response(res.body, { status: res.status, headers: headers });
  },
  async scheduled(controller, env, ctx) {
    /* cron jobs */
  },
};
