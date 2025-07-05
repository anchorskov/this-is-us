/* worker/src/index.mjs */
import { Router } from 'itty-router';

// Import all your route handlers
import { handleListEvents, handleGetEventPdf, handleCreateEvent } from './routes/events.js';
import { handleSandboxAnalyze } from './routes/sandbox.js';
import { handleCreateTownhallPost, handleListTownhallPosts, handleDeleteTownhallPost } from './townhall/createPost.js';

const router = Router();

/* ──────────────────── Routes ──────────────────── */
// Event Routes
router.get('/api/events', handleListEvents);
router.get('/api/events/pdf/:key', handleGetEventPdf);
router.post('/api/events/create', handleCreateEvent);

// Town-Hall Routes
router.post('/api/townhall/create', handleCreateTownhallPost);
router.get('/api/townhall/posts', handleListTownhallPosts);
router.post('/api/townhall/delete', handleDeleteTownhallPost);

// Debug & Sandbox Routes
router.get('/api/_debug/schema', /* ... (this can also be moved) ... */);
router.post('/api/sandbox/analyze', handleSandboxAnalyze);

// Health & Fallback
router.get('/api/_health', () => new Response(JSON.stringify({ ok: true })));
router.all('*', () => new Response('Not found', { status: 404 }));

/* ──────────────────── Worker Export ──────────────────── */
export default {
  async fetch(request, env, ctx) {
    // ... (your existing CORS logic remains the same) ...
    const res = await router.fetch(request, env, ctx);
    // ... (your existing CORS header logic remains the same) ...
    return new Response(res.body, { status: res.status, headers: res.headers });
  },

  async scheduled(controller, env, ctx) {
    // ... (your existing scheduled cleanup logic remains the same) ...
  },
};