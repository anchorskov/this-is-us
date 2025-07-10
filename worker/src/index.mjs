import { Router } from 'itty-router';

// Events
import { handleListEvents, handleGetEventPdf, handleCreateEvent } from './routes/events.js';

// Townhall
import { handleCreateTownhallPost } from './townhall/createPost.js';
import { handleListTownhallPosts } from './townhall/listPosts.js';
import { handleDeleteTownhallPost } from './townhall/deletePost.js';

// Sandbox & Debug
import { handleSandboxAnalyze } from './routes/sandbox.js';

// ✅ New: Preferences + Admin Topic Moderation
import { handlePreferencesRequest } from './account/preferences.js';
import { handleTopicRequests } from './account/topic-requests.js';

const router = Router();

/* ──────────────────── Routes ──────────────────── */

// Events
router.get('/api/events', handleListEvents);
router.get('/api/events/pdf/:key', handleGetEventPdf);
router.post('/api/events/create', handleCreateEvent);

// Townhall
router.post('/api/townhall/create', handleCreateTownhallPost);
router.get('/api/townhall/posts', handleListTownhallPosts);
router.post('/api/townhall/delete', handleDeleteTownhallPost);

// Sandbox & Debug
router.get('/api/_debug/schema', () => new Response("Debug schema route"));
router.post('/api/sandbox/analyze', handleSandboxAnalyze);

// ✅ Preferences: Verified users get/set topics
router.get('/api/preferences', handlePreferencesRequest);
router.post('/api/preferences', handlePreferencesRequest);

// ✅ Admin: Moderate topic_requests
router.get('/api/topic-requests', handleTopicRequests);
router.post('/api/topic-requests', handleTopicRequests);

// Health
router.get('/api/_health', () => new Response(JSON.stringify({ ok: true })));
router.all('*', () => new Response('Not found', { status: 404 }));

/* ──────────────────── Worker Export ──────────────────── */
export default {
  async fetch(request, env, ctx) {
    const res = await router.fetch(request, env, ctx);
    return new Response(res.body, { status: res.status, headers: res.headers });
  },

  async scheduled(controller, env, ctx) {
    // Existing cron jobs
  }
};
