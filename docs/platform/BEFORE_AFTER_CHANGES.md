// BEFORE vs AFTER: Code Changes for Verified Voter Implementation

═══════════════════════════════════════════════════════════════════════════
FILE 1: worker/src/townhall/createThread.mjs
═══════════════════════════════════════════════════════════════════════════

BEFORE:
──────
// worker/src/townhall/createThread.mjs
// POST /api/townhall/posts — create a Town Hall thread in D1 (EVENTS_DB)

import { requireAuth } from "../auth/verifyFirebaseOrAccess.mjs";

const OK_HEADERS = { "Content-Type": "application/json" };

// ... validateBody function ...

export async function handleCreateTownhallThread(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: OK_HEADERS,
    });
  }

  let identity;
  try {
    identity = await requireAuth(request, env);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", details: err?.message }),
      { status: 401, headers: OK_HEADERS }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch (err) {
    // ... error handling ...
  }

  const { errors, title, prompt, city, state } = validateBody(body);

  // ... validation ...

  // DIRECTLY PROCEEDS TO INSERT WITHOUT VERIFICATION
  const threadId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  try {
    await env.EVENTS_DB.prepare(`
      INSERT INTO townhall_posts (...)
      VALUES (...)
    `).bind(...).run();

    return new Response(
      JSON.stringify({ thread_id: threadId, created_at: createdAt }),
      { status: 201, headers: OK_HEADERS }
    );
  } catch (err) {
    // ... error handling ...
  }
}


AFTER:
──────
// worker/src/townhall/createThread.mjs
// POST /api/townhall/posts — create a Town Hall thread in D1 (EVENTS_DB)
// Requires verified voter status via WY_DB.verified_users bridge table

import { requireAuth } from "../auth/verifyFirebaseOrAccess.mjs";
import { getVerifiedUser } from "./verifiedUserHelper.mjs";  // ← NEW IMPORT

const OK_HEADERS = { "Content-Type": "application/json" };

// ... validateBody function ...

export async function handleCreateTownhallThread(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: OK_HEADERS,
    });
  }

  let identity;
  try {
    identity = await requireAuth(request, env);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", details: err?.message }),
      { status: 401, headers: OK_HEADERS }
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // CHECK VERIFIED VOTER STATUS ← NEW CODE BLOCK
  // ──────────────────────────────────────────────────────────────────────
  const verifiedUser = await getVerifiedUser(env, identity.uid);
  if (!verifiedUser) {
    return new Response(
      JSON.stringify({
        error: "not_verified",
        message: "Verified county voter account required to create Town Hall threads.",
      }),
      { status: 403, headers: OK_HEADERS }
    );
  }
  // ──────────────────────────────────────────────────────────────────────

  let body = {};
  try {
    body = await request.json();
  } catch (err) {
    // ... error handling ...
  }

  const { errors, title, prompt, city, state } = validateBody(body);

  // ... validation ...

  const threadId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  try {
    await env.EVENTS_DB.prepare(`
      INSERT INTO townhall_posts (...)
      VALUES (...)
    `).bind(...).run();

    return new Response(
      JSON.stringify({ thread_id: threadId, created_at: createdAt }),
      { status: 201, headers: OK_HEADERS }
    );
  } catch (err) {
    // ... error handling ...
  }
}


CHANGES SUMMARY:
  + Line 2: Added comment about verified voter requirement
  + Line 4: NEW IMPORT: getVerifiedUser from verifiedUserHelper
  + Lines 46-57: NEW CODE BLOCK: Verification check
    - Call getVerifiedUser() with Firebase UID
    - If not verified, return 403 with error message
    - If verified, continue to existing INSERT logic


═══════════════════════════════════════════════════════════════════════════
FILE 2: worker/src/townhall/createPost.js
═══════════════════════════════════════════════════════════════════════════

BEFORE:
──────
// worker/src/townhall/createPost.js

import { requireAuth } from "../auth/verifyFirebaseOrAccess.mjs";
import { withRestrictedCORS, TOWNHALL_ALLOWED_ORIGINS } from "../utils/cors.js";

export async function handleCreateTownhallPost(request, env) {
  const identity = await requireAuth(request, env);
  const form = await request.formData();

  const userId    = identity.uid;
  const title     = form.get('title')?.trim();
  const prompt    = form.get('prompt')?.trim();
  const city      = form.get('city')?.trim() || '';
  const state     = form.get('state')?.trim() || '';
  const file      = form.get('file');

  // Validate required field
  if (!title) {
    return new Response(JSON.stringify({ error: 'Missing title' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ... file validation and R2 upload ...

  try {
    // ... file handling ...

    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    // DIRECTLY PROCEEDS TO INSERT WITHOUT VERIFICATION
    await env.EVENTS_DB.prepare(`
      INSERT INTO townhall_posts (...)
      VALUES (...)
    `).bind(...).run();

    return withRestrictedCORS(
      JSON.stringify({ success: true }),
      201,
      { 'Content-Type': 'application/json' },
      request,
      TOWNHALL_ALLOWED_ORIGINS
    );

  } catch (err) {
    console.error("❌ Error creating post:", err.stack || err);
    return withRestrictedCORS(
      JSON.stringify({ error: 'Failed to create post' }),
      500,
      { 'Content-Type': 'application/json' },
      request,
      TOWNHALL_ALLOWED_ORIGINS
    );
  }
}


AFTER:
──────
// worker/src/townhall/createPost.js
// POST /api/townhall/thread/:threadId/comment — create a comment in Town Hall thread
// Requires verified voter status via WY_DB.verified_users bridge table

import { requireAuth } from "../auth/verifyFirebaseOrAccess.mjs";
import { getVerifiedUser } from "./verifiedUserHelper.mjs";  // ← NEW IMPORT
import { withRestrictedCORS, TOWNHALL_ALLOWED_ORIGINS } from "../utils/cors.js";

export async function handleCreateTownhallPost(request, env) {
  const identity = await requireAuth(request, env);
  
  // ──────────────────────────────────────────────────────────────────────
  // CHECK VERIFIED VOTER STATUS ← NEW CODE BLOCK
  // ──────────────────────────────────────────────────────────────────────
  const verifiedUser = await getVerifiedUser(env, identity.uid);
  if (!verifiedUser) {
    return withRestrictedCORS(
      JSON.stringify({
        error: "not_verified",
        message: "Verified county voter account required to post in Town Hall.",
      }),
      403,
      { 'Content-Type': 'application/json' },
      request,
      TOWNHALL_ALLOWED_ORIGINS
    );
  }
  // ──────────────────────────────────────────────────────────────────────
  
  const form = await request.formData();

  const userId    = identity.uid;
  const title     = form.get('title')?.trim();
  const prompt    = form.get('prompt')?.trim();
  const city      = form.get('city')?.trim() || '';
  const state     = form.get('state')?.trim() || '';
  const file      = form.get('file');

  // Validate required field
  if (!title) {
    return new Response(JSON.stringify({ error: 'Missing title' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ... file validation and R2 upload ...

  try {
    // ... file handling ...

    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    // PROCEEDS TO INSERT ONLY IF VERIFIED
    await env.EVENTS_DB.prepare(`
      INSERT INTO townhall_posts (...)
      VALUES (...)
    `).bind(...).run();

    return withRestrictedCORS(
      JSON.stringify({ success: true }),
      201,
      { 'Content-Type': 'application/json' },
      request,
      TOWNHALL_ALLOWED_ORIGINS
    );

  } catch (err) {
    console.error("❌ Error creating post:", err.stack || err);
    return withRestrictedCORS(
      JSON.stringify({ error: 'Failed to create post' }),
      500,
      { 'Content-Type': 'application/json' },
      request,
      TOWNHALL_ALLOWED_ORIGINS
    );
  }
}


CHANGES SUMMARY:
  + Line 2-3: Added comments about verified voter requirement and bridge table
  + Line 5: NEW IMPORT: getVerifiedUser from verifiedUserHelper
  + Lines 8-22: NEW CODE BLOCK: Verification check
    - Call getVerifiedUser() with Firebase UID
    - If not verified, return 403 with error message using CORS wrapper
    - If verified, continue to existing form parsing and INSERT logic


═══════════════════════════════════════════════════════════════════════════
UNCHANGED FILES (for reference)
═══════════════════════════════════════════════════════════════════════════

✓ worker/src/townhall/deletePost.js
  └─ Already has authorization check:
     const isOwner = post.user_id === userId;
     const isAdmin = userRole.toLowerCase() === 'admin';
     if (!isOwner && !isAdmin) { return 403; }
  └─ No verification check needed (owner-based delete)

✓ worker/src/townhall/listPosts.js
  └─ Read-only, no auth required
  └─ No verification check needed


═══════════════════════════════════════════════════════════════════════════
NEW FILE: worker/src/townhall/verifiedUserHelper.mjs
═══════════════════════════════════════════════════════════════════════════

// worker/src/townhall/verifiedUserHelper.mjs
// Helper functions for verified voter checks in Town Hall operations

export async function getVerifiedUser(env, userId) {
  if (!userId || !env.WY_DB) {
    return null;
  }

  try {
    const { results } = await env.WY_DB.prepare(`
      SELECT
        user_id as userId,
        voter_id as voterId,
        county,
        house,
        senate,
        verified_at as verifiedAt,
        status
      FROM verified_users
      WHERE user_id = ?1 AND status = 'verified'
      LIMIT 1
    `)
      .bind(userId)
      .all();

    return results && results.length > 0 ? results[0] : null;
  } catch (err) {
    console.error(`[verifiedUserHelper] Error checking verified status for ${userId}:`, err);
    return null;
  }
}

export async function createVerifiedUser(env, userId, voterId, voterInfo = {}) {
  if (!userId || !voterId || !env.WY_DB) {
    return false;
  }

  try {
    const verifiedAt = new Date().toISOString();
    const { county, house, senate } = voterInfo;

    await env.WY_DB.prepare(`
      INSERT INTO verified_users (
        user_id,
        voter_id,
        county,
        house,
        senate,
        verified_at,
        status
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'verified')
    `)
      .bind(userId, voterId, county || null, house || null, senate || null, verifiedAt)
      .run();

    return true;
  } catch (err) {
    console.error(`[verifiedUserHelper] Error creating verified user ${userId}:`, err);
    return false;
  }
}

export async function revokeVerifiedUser(env, userId) {
  if (!userId || !env.WY_DB) {
    return false;
  }

  try {
    await env.WY_DB.prepare(`
      UPDATE verified_users
      SET status = 'revoked'
      WHERE user_id = ?1
    `)
      .bind(userId)
      .run();

    return true;
  } catch (err) {
    console.error(`[verifiedUserHelper] Error revoking verified user ${userId}:`, err);
    return false;
  }
}


═══════════════════════════════════════════════════════════════════════════
NEW FILE: worker/migrations_wy/0018_create_verified_users.sql
═══════════════════════════════════════════════════════════════════════════

-- Migration: Create verified_users bridge table
-- Purpose: Gate Town Hall posting and voting to verified county voters
-- Date: 2025-12-09

CREATE TABLE IF NOT EXISTS verified_users (
  user_id TEXT PRIMARY KEY,
  voter_id TEXT NOT NULL UNIQUE,
  county TEXT,
  house TEXT,
  senate TEXT,
  verified_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'verified',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  
  FOREIGN KEY (voter_id) REFERENCES voters_addr_norm(voter_id) ON DELETE RESTRICT
);

-- Index on voter_id for reverse lookups (voter -> user)
CREATE INDEX IF NOT EXISTS idx_verified_users_voter_id ON verified_users(voter_id);

-- Index on status for efficient filtering of active verified records
CREATE INDEX IF NOT EXISTS idx_verified_users_status ON verified_users(status);

-- Composite index for common query pattern: user + status
CREATE INDEX IF NOT EXISTS idx_verified_users_user_status ON verified_users(user_id, status);


═══════════════════════════════════════════════════════════════════════════
SUMMARY OF CHANGES
═══════════════════════════════════════════════════════════════════════════

TOTAL LINES CHANGED:
  - createThread.mjs: +2 import lines, +12 verification logic = 14 lines
  - createPost.js: +2 import lines, +15 verification logic = 17 lines
  - Total added: 31 lines of code

NEW FILES CREATED:
  - verifiedUserHelper.mjs: 102 lines
  - 0018_create_verified_users.sql: 29 lines
  - Tests: 220 lines
  - Documentation: 570+ lines

BEHAVIOR CHANGE:
  BEFORE: requireAuth() → INSERT
  AFTER:  requireAuth() → getVerifiedUser() → [verified?] → INSERT

IMPACT:
  ✅ Non-breaking for read operations
  ✅ Non-breaking for existing verified data
  ✅ Non-breaking for delete operations
  ❌ Breaking for UNVERIFIED users trying to POST (expected 403)

═══════════════════════════════════════════════════════════════════════════
