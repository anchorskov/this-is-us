# Podcast API Deploy & Test Plan – December 14, 2025

## Summary of Changes

### 1. Dual Route Registration
**File:** `worker/src/index.mjs` (lines ~157-161)
- Registered `/api/podcast/summary` (existing)
- **NEW:** Registered `/podcast/summary` (alternate path)
- Prevents prefix mismatches between environment routing configurations

### 2. Diagnostic Logging
**File:** `worker/src/routes/podcastSummary.mjs` (lines 4-9)
- Added console logs for pathname and query params
- Logs: `[podcast/summary] pathname: /api/podcast/summary, query: ?guest=...`
- Helps diagnose if the route is receiving requests and with correct params

### 3. Routes Debug Endpoint
**File:** `worker/src/index.mjs` (lines ~162-203)
- **NEW:** `GET /api/_routes` endpoint (dev-only, local access only)
- Returns JSON list of all registered routes
- Useful for verifying deployment consistency

### 4. JavaScript Client Fallback Retry
**File:** `static/js/podcast-summary.js` (lines 38-65)
- Primary path: `${apiBase}/podcast/summary?...` (e.g., `/api/podcast/summary`)
- Fallback: If primary returns 404, retry with alternate: `${altApiBase}/podcast/summary` (e.g., `/podcast/summary`)
- Logs retry attempts: "podcast summary: primary 404, retrying alternate path"

### 5. D1 Migrations Verified
**Files:**
- `worker/migrations/0021_create_podcast_uploads.sql` ✓ (creates table with 8 fields + 3 UNIQUE constraints)
- `worker/migrations/0022_add_summary_to_podcast_uploads.sql` ✓ (adds summary TEXT column)
- Both migrations exist and will auto-apply on Worker deploy

---

## Exact Deploy Commands

### Step 1: Commit changes to git
```bash
cd /home/anchor/projects/this-is-us
git add worker/src/index.mjs worker/src/routes/podcastSummary.mjs static/js/podcast-summary.js
git commit -m "Fix podcast API 404: add dual routes, diagnostic logs, fallback retry"
git push origin main
```

### Step 2: Deploy Worker
Run from `worker/` directory:
```bash
cd /home/anchor/projects/this-is-us/worker
wrangler deploy --env production
```

**What this does:**
- Compiles Worker code (src/index.mjs + all routes)
- Applies all migrations (0021, 0022) to production D1
- Deploys bindings: EVENTS_DB (production), PODCASTS (R2)
- Registers routes: `https://this-is-us.org/api/*` and new paths
- Updates Worker version

**Expected output:**
```
✓ Uploaded worker (XX.XXkB)
✓ Successfully deployed to https://this-is-us-events.anchorskov.workers.dev
Migrations:
  ✓ 0021_create_podcast_uploads.sql
  ✓ 0022_add_summary_to_podcast_uploads.sql
```

### Step 3: Build & Deploy Hugo
Hugo Pages deployment is separate – run if you made content changes:
```bash
cd /home/anchor/projects/this-is-us
npm run build:hugo
# Hugo auto-builds and deploys to Cloudflare Pages (main branch)
```

**Important:** Pages deployment does NOT deploy the Worker. Worker must be deployed separately via `wrangler deploy`.

### Step 4: Verify Migration Applied (Production D1)
```bash
cd /home/anchor/projects/this-is-us/worker
wrangler d1 execute EVENTS_DB --env production --remote "PRAGMA table_info('podcast_uploads');"
```

Expected output: Column list including `summary TEXT`

---

## Test Plan with Exact Commands

### Phase 1: Health Check (verify API routing works)
```bash
curl -i https://this-is-us.org/api/_health
```
**Expected:** HTTP 200, JSON response
**Diagnostic:** If 404 or timeout, Worker routing misconfigured

### Phase 2: Routes Debug (verify dual routes deployed)
```bash
curl -i http://127.0.0.1:8787/api/_routes
```
**Expected:** HTTP 200, JSON with list including:
- `"GET /api/podcast/summary"`
- `"GET /podcast/summary"`

**Note:** This only works on localhost (dev-only endpoint)

### Phase 3: Test Primary Path
```bash
curl -i "https://this-is-us.org/api/podcast/summary?guest=jr-riggins&date=2025-12-14&part=1"
```
**Expected:** HTTP 200 or 404 (not 404, 404 means route not found)
**Possible responses:**
- 200: `{"guest_slug":"jr-riggins","episode_date":"2025-12-14","part_number":1,"r2_key":"...","summary":"..."}`
- Missing column 404: `{"summary":null,"available":false,"reason":"summary column not available"}`
- Missing data: `{"summary":null,"available":false,"reason":"summary not found"}`

### Phase 4: Test Alternate Path (fallback)
```bash
curl -i "https://this-is-us.org/podcast/summary?guest=jr-riggins&date=2025-12-14&part=1"
```
**Expected:** Same as Phase 3 – should work if primary is 404
**Note:** If both paths fail, the JavaScript client will show "Summary not available."

### Phase 5: Check Browser Console
Open https://this-is-us.org/podcast/ in browser:
1. Click "Show summary" button
2. Open DevTools → Console
3. Look for:
   - `[podcast/summary] pathname: /api/podcast/summary, query: ?guest=...` (Worker logs)
   - `"podcast summary: primary 404, retrying alternate path"` (if primary failed)
4. Modal should display summary text or "Summary not available."

---

## Root Cause Analysis

**Why `/api/podcast/summary` returned 404 in production:**
- Worker route configured: `routes = [ "https://this-is-us.org/api/*" ]` ✓
- Handler registered: `router.get("/api/podcast/summary", ...)` ✓
- Pages routing or deployment may not have fully synced the new route

**Why adding `/podcast/summary` helps:**
- If Pages routing strips `/api` prefix, the alternate path catches it
- JavaScript client retries on 404, maximizing compatibility
- Dual routes cost nothing and eliminate ambiguity

**Why health check works but podcast doesn't:**
- `/api/_health` likely registered before this deployment cycle
- Shows that some routes work, suggesting partial deployment or routing cache issue
- New routes may need force-refresh or cache clear

---

## Verification Checklist

- [ ] Git commit successful: `git log --oneline | head -1` shows podcast commit
- [ ] Worker deploy successful: `wrangler deploy --env production` exits 0
- [ ] Migrations applied: `PRAGMA table_info('podcast_uploads')` shows `summary` column
- [ ] Routes registered: Localhost debug returns both paths
- [ ] Primary path responds: `curl https://this-is-us.org/api/podcast/summary?...` returns 200 or JSON error (not 404)
- [ ] Alternate path responds: `curl https://this-is-us.org/podcast/summary?...` returns 200 or JSON error (not 404)
- [ ] Browser console logs appear when button clicked
- [ ] Modal displays summary or "Summary not available."
- [ ] No JavaScript errors in browser console

---

## Rollback Plan

If deployment breaks other endpoints:
```bash
cd /home/anchor/projects/this-is-us/worker
git revert HEAD~1
git push origin main
wrangler deploy --env production
```

---

## Next Steps After Successful Deployment

1. Monitor browser console for logs on https://this-is-us.org/podcast/
2. Check Worker Tail for errors: `wrangler tail --env production`
3. Verify summaries load in modal
4. Remove diagnostic logs (optional) in next iteration if no issues found
5. Consider removing `/api/_routes` debug endpoint after troubleshooting complete
