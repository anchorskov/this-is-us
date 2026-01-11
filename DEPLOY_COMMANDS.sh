#!/bin/bash
# PODCAST API FIX - EXACT DEPLOY COMMANDS
# Run these in order from /home/anchor/projects/this-is-us

# ============================================================================
# STEP 1: VERIFY CHANGES ARE COMMITTED
# ============================================================================
cd /home/anchor/projects/this-is-us
git log --oneline | head -1
# Expected output: 807931b Fix podcast API 404: ...

# ============================================================================
# STEP 2: DEPLOY WORKER (RUN FROM worker/ DIRECTORY)
# ============================================================================
cd /home/anchor/projects/this-is-us/worker
./scripts/wr deploy --env production

# This will:
# ✓ Compile worker/src/index.mjs (with dual routes)
# ✓ Apply migrations 0021, 0022 to production D1
# ✓ Deploy bindings (EVENTS_DB, PODCASTS)
# ✓ Register routes: https://this-is-us.org/api/*
# ✓ Output new Worker version

# Expected output pattern:
#   ✓ Uploaded worker (XX.XXkB)
#   ✓ Successfully deployed to https://this-is-us-events.anchorskov.workers.dev
#   Migrations:
#     ✓ 0021_create_podcast_uploads.sql
#     ✓ 0022_add_summary_to_podcast_uploads.sql

# ============================================================================
# STEP 3: VERIFY D1 MIGRATION (PRODUCTION)
# ============================================================================
# Optional: Check that summary column exists after deploy
cd /home/anchor/projects/this-is-us/worker
./scripts/wr d1 execute EVENTS_DB --env production --remote "PRAGMA table_info('podcast_uploads');"

# Expected: Column list includes { "name": "summary", "type": "TEXT" ... }

# ============================================================================
# STEP 4: PRODUCTION TEST COMMANDS (RUN SEQUENTIALLY)
# ============================================================================

# Test 4a: Health check (proves API routing works)
curl -i https://this-is-us.org/api/_health

# Expected: HTTP 200 OK with JSON

# Test 4b: Primary path
curl -i "https://this-is-us.org/api/podcast/summary?guest=jr-riggins&date=2025-12-14&part=1"

# Expected: HTTP 200 with JSON summary, OR HTTP 200 with JSON error message
#           (NOT 404 - if 404, route not registered)
# Possible responses:
#   {"guest_slug":"jr-riggins","episode_date":"2025-12-14","part_number":1,"r2_key":"...","summary":"..."}
#   {"summary":null,"available":false,"reason":"summary column not available"}
#   {"summary":null,"available":false,"reason":"summary not found"}

# Test 4c: Alternate path (fallback)
curl -i "https://this-is-us.org/podcast/summary?guest=jr-riggins&date=2025-12-14&part=1"

# Expected: Same as 4b - should work if primary is 404

# Test 4d: Local routes debug (dev-only)
curl -i http://127.0.0.1:8787/api/_routes

# Expected: HTTP 200 with JSON list including:
#   "GET /api/podcast/summary"
#   "GET /podcast/summary"

# ============================================================================
# STEP 5: BROWSER TEST
# ============================================================================
# 1. Open https://this-is-us.org/podcast/ in browser
# 2. Click "Show summary" button on any part
# 3. Open DevTools → Console (F12)
# 4. Look for logs:
#    - [podcast/summary] pathname: /api/podcast/summary, query: ?guest=...
#    - "podcast summary: primary 404, retrying alternate path" (if primary fails)
# 5. Modal should display summary text or "Summary not available."
# 6. No JavaScript errors

# ============================================================================
# WHAT WAS CHANGED
# ============================================================================
# File: worker/src/index.mjs
#   - Added route: router.get("/podcast/summary", handleGetPodcastSummary)
#   - Added debug endpoint: GET /api/_routes (dev-only)
#
# File: worker/src/routes/podcastSummary.mjs
#   - Added console logs for pathname and query params
#
# File: static/js/podcast-summary.js
#   - Added fallback retry: if primary 404, retry alternate path
#   - Logs retry attempts to console
#
# File: PODCAST_DEPLOY_TEST_PLAN.md
#   - Comprehensive guide (reference only, not deployed)

# ============================================================================
# IF TESTS FAIL
# ============================================================================

# If primary path still returns 404:
#   a) Check Worker deployment: ./scripts/wr deployments list --env production
#   b) Force redeploy: ./scripts/wr deploy --env production --force
#   c) Check Pages routing: may need cache clear or Pages rebuild
#   d) Check alternate path works: curl /podcast/summary
#   e) Check debug endpoint: curl localhost:8787/api/_routes

# If all paths fail:
#   a) Verify Worker is receiving requests: ./scripts/wr tail --env production
#   b) Check EVENTS_DB binding: migration logs in wrangler output
#   c) Rollback: git revert HEAD~1, git push origin main, ./scripts/wr deploy --env production

# ============================================================================
# NOTES
# ============================================================================
# - Pages deployment (Hugo) is SEPARATE - does NOT deploy the Worker
# - Worker must be deployed via wrangler from worker/ directory
# - D1 migrations auto-apply on Worker deploy
# - Diagnostic logs will appear in Worker Tail (./scripts/wr tail)
# - Debug endpoint (/api/_routes) only works on localhost (dev-only guard)
# - JavaScript fallback retry is transparent to user - modal shows result either way
