/* worker/src/utils/cors.js */

/**
 * Base CORS headers object.
 * (Replace "*" with an allow-list entry in production.)
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Legacy alias for older route files (e.g., routes/events.js)
 * Returns the same object as CORS_HEADERS.
 */
export const corsHeaders = () => CORS_HEADERS;

/**
 * handleCORSPreflight(request)
 *   – If the request is OPTIONS, return a 204 with CORS headers.
 *   – Otherwise return null so the caller continues processing.
 */
export function handleCORSPreflight(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return null;
}

/**
 * withCORS(body = null, status = 200, extraHeaders = {})
 * Wrap any response body and merge in the shared CORS headers.
 *
 * Example:
 *   return withCORS(JSON.stringify(data), 200, { "Content-Type": "application/json" });
 */
export function withCORS(body = null, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, ...extraHeaders },
  });
}
