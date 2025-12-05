/**
 * worker/src/utils/cors.js
 *
 * Shared helpers for CORS handling in Cloudflare Worker routes.
 * ------------------------------------------------------------
 * In dev (hugo server -D) we allow http://localhost:1313.
 * In production we default to "*", or replace with an allow-list.
 */

/**
 * Base CORS headers object.
 * (Replace "*" with an allow-list entry in production.)
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Legacy alias for older route files (e.g., routes/events.js)
 * Returns the same object as CORS_HEADERS.
 */
export const corsHeaders = () => CORS_HEADERS;

/**
 * Local preview origin used by `hugo server -D`.
 * Browsers require an exact string match for Access-Control-Allow-Origin.
 */
const DEV_ORIGIN = "http://localhost:1313";
const DEFAULT_ALLOWLIST = [
  "https://this-is-us.org",
  "https://www.this-is-us.org",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
  DEV_ORIGIN,
];

/**
 * resolveOrigin(request)
 *   – If the incoming request’s Origin header matches DEV_ORIGIN, echo it.
 *   – Otherwise fallback to "*" (or tighten to production allow-list).
 */
function resolveOrigin(request, allowlist = []) {
  const origin = request?.headers.get("Origin");
  if (allowlist.length) {
    return allowlist.includes(origin) ? origin : null;
  }
  return origin === DEV_ORIGIN ? DEV_ORIGIN : "*";
}

/**
 * handleCORSPreflight(request)
 *   – If the request is OPTIONS, return a 204 with CORS headers.
 *   – Otherwise return null so the caller continues processing.
 */
export function handleCORSPreflight(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
        "Access-Control-Allow-Origin": resolveOrigin(request),
      },
    });
  }
  return null;
}

/**
 * withCORS(body = null, status = 200, extraHeaders = {}, request = null)
 * Wrap any response body and merge in the shared CORS headers.
 *
 * Example:
 *   return withCORS(
 *     JSON.stringify(data),
 *     200,
 *     { "Content-Type": "application/json" },
 *     request
 *   );
 */
export function withCORS(
  body = null,
  status = 200,
  extraHeaders = {},
  request = null
) {
  const baseHeaders = {
    ...CORS_HEADERS,
    "Access-Control-Allow-Origin": resolveOrigin(request),
  };
  return new Response(body, {
    status,
    headers: { ...baseHeaders, ...extraHeaders },
  });
}

/**
 * withRestrictedCORS – allow only configured origins, else 403.
 */
export function withRestrictedCORS(
  body = null,
  status = 200,
  extraHeaders = {},
  request = null,
  allowlist = DEFAULT_ALLOWLIST
) {
  const origin = resolveOrigin(request, allowlist);
  if (!origin) {
    return new Response("CORS origin not allowed", { status: 403 });
  }
  return new Response(body, {
    status,
    headers: {
      ...CORS_HEADERS,
      "Access-Control-Allow-Origin": origin,
      ...extraHeaders,
    },
  });
}

export function handleRestrictedPreflight(
  request,
  allowlist = DEFAULT_ALLOWLIST
) {
  if (request.method !== "OPTIONS") return null;
  const origin = resolveOrigin(request, allowlist);
  if (!origin) return new Response("CORS origin not allowed", { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      "Access-Control-Allow-Origin": origin,
    },
  });
}

export const TOWNHALL_ALLOWED_ORIGINS = DEFAULT_ALLOWLIST;
