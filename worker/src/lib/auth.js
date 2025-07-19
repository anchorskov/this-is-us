// worker/src/lib/auth.js – authentication utilities for Cloudflare Workers
import { jwtVerify, createRemoteJWKSet } from "jose";

/* ─── Lazy-init project constants ─────────────────────────────────── */
let PROJECT_ID  = null;
let ISSUER      = null;
const JWKS_URL  = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const JWKS      = createRemoteJWKSet(new URL(JWKS_URL));

/**
 * initAuth(env)
 *   – Initialise PROJECT_ID / ISSUER once per Worker instance.
 *   – Must be called with the `env` object passed to your route handler.
 */
function initAuth(env) {
  if (PROJECT_ID) return;                       // already set
  PROJECT_ID = env.FIREBASE_PROJECT_ID;         // bound in wrangler.toml
  if (!PROJECT_ID)
    throw new Error("Missing FIREBASE_PROJECT_ID in Worker env.");

  ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
}

const isDevRuntime = () => !!globalThis.__DEV_WORKER__;

/* ─── Session helpers ─────────────────────────────────────────────── */

/**
 * verifySession(request, env)
 *   – Returns `{ user }` when the caller is authenticated.
 *   – Returns `{ user:null }` when no/invalid token supplied.
 *   • Dev mode: any non-empty Bearer token passes.
 *   • Prod: full Firebase JWT verification.
 */
export async function verifySession(request, env) {
  initAuth(env);

  const rawAuth = request.headers.get("Authorization") || "";
  const [, idToken] = rawAuth.split("Bearer ");

  /* no header → unauthenticated */
  if (!idToken) return { user: null };

  /* ─── Dev shortcut ──────────────────────────────────────────────── */
  if (isDevRuntime()) {
    return {
      user: {
        uid: "dev-" + idToken.slice(0, 8),      // stable pseudo-uid
        email_verified: true,
      },
    };
  }

  /* ─── Production verification ──────────────────────────────────── */
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer:   ISSUER,
      audience: PROJECT_ID,
    });
    return { user: payload };                   // uid is payload.user_id
  } catch (err) {
    console.warn("verifySession failed:", err.message);
    return { user: null };
  }
}

/** Return caller’s UID or throw 401 */
export async function getUserId(request, env) {
  const { user } = await verifySession(request, env);
  if (!user) throw new Response("Unauthenticated", { status: 401 });
  return user.user_id || user.uid;              // supports dev & prod payloads
}
