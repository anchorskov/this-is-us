// worker/src/auth/verifyFirebaseOrAccess.mjs
// Shared auth helper for Firebase ID tokens **or** Cloudflare Access headers.
// Usage: const identity = await requireAuth(request, env);
// Returns { uid, email, source } or throws Response(401/403).

import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

const DEV_BYPASS = () => !!globalThis.__DEV_WORKER__;

function parseCookies(header) {
  return (header || "").split(";").reduce((acc, pair) => {
    const [k, v] = pair.split("=").map((s) => s && s.trim());
    if (k) acc[k] = decodeURIComponent(v || "");
    return acc;
  }, {});
}

function extractIdToken(request) {
  const auth = request.headers.get("Authorization") || "";
  const [, bearer] = auth.split("Bearer ");
  if (bearer) return bearer.trim();

  const cookies = parseCookies(request.headers.get("Cookie"));
  return cookies.__session || cookies.session || null;
}

async function verifyFirebaseToken(token, env) {
  if (!token) return null;

  if (DEV_BYPASS()) {
    return { uid: `dev-${token.slice(0, 8)}`, email: "dev@example.com" };
  }

  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Missing FIREBASE_PROJECT_ID");

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  return {
    uid: payload.user_id || payload.uid,
    email: payload.email || null,
  };
}

function fromAccessHeaders(request) {
  const email =
    request.headers.get("CF-Access-Authenticated-User-Email") || null;
  const sub = request.headers.get("CF-Access-Authenticated-User-Id") || null;
  if (!email && !sub) return null;
  return {
    uid: sub || email,
    email,
    source: "access",
  };
}

export async function requireAuth(request, env) {
  // 1) Prefer Cloudflare Access (Zero Trust) headers
  const accessIdentity = fromAccessHeaders(request);
  if (accessIdentity) return { ...accessIdentity, source: "access" };

  // 2) Fallback to Firebase ID token (Bearer or session cookie)
  const token = extractIdToken(request);
  const firebaseIdentity = await verifyFirebaseToken(token, env).catch(
    () => null
  );
  if (firebaseIdentity) return { ...firebaseIdentity, source: "firebase" };

  throw new Response("Unauthenticated", { status: 401 });
}

/**
 * Optionally allow anonymous calls but surface identity when present.
 */
export async function getOptionalIdentity(request, env) {
  try {
    return await requireAuth(request, env);
  } catch {
    return null;
  }
}
