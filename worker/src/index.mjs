/* worker/src/index.mjs – central route map */
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
import { handleListTownhallPosts }  from "./townhall/listPosts.js";
import { handleDeleteTownhallPost } from "./townhall/deletePost.js";

// Sandbox & Debug
import { handleSandboxAnalyze } from "./routes/sandbox.js";

// Preferences & Topics
import { register as registerPreferences } from "./routes/preferences.js";
import { handlePublicTopicIndex }          from "./routes/topic-index.js";
import { handleTopicRequests }             from "./account/topic-requests.js";

// User sync
import { handleSyncUser } from "./routes/sync-user.js";

// Shared CORS helper
import { handleCORSPreflight } from "./utils/cors.js";

/* ─────────── Router setup ─────────── */
const router = Router();

/* Global CORS pre-flight  */
router.options("*", handleCORSPreflight);

/* Events */
router
  .get ("/api/events",          handleListEvents)
  .get ("/api/events/pdf/:key", handleGetEventPdf)
  .post("/api/events/create",   handleCreateEvent);

/* Townhall */
router
  .post("/api/townhall/create", handleCreateTownhallPost)
  .get ("/api/townhall/posts",  handleListTownhallPosts)
  .post("/api/townhall/delete", handleDeleteTownhallPost);

/* Sandbox & debug */
router
  .get ("/api/_debug/schema",   () => new Response("Debug schema route"))
  .post("/api/sandbox/analyze", handleSandboxAnalyze);

/* Preferences & topics */
registerPreferences(router);               // mounts GET/POST /api/preferences
router.get("/api/topic-index", handlePublicTopicIndex);
router
  .get ("/api/topic-requests", handleTopicRequests)
  .post("/api/topic-requests", handleTopicRequests)
  .post("/api/sync-user",      handleSyncUser);

/* Health & fallback */
router.get("/api/_health", () => new Response(JSON.stringify({ ok: true })));
router.all("*",            () => new Response("Not found", { status: 404 }));

/* ─────────── Worker export ─────────── */
export default {
  async fetch(request, env, ctx) {
    const res = await router.fetch(request, env, ctx);
    return new Response(res.body, { status: res.status, headers: res.headers });
  },
  async scheduled(controller, env, ctx) {
    /* cron jobs */
  },
};
