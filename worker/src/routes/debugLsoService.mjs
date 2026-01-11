// worker/src/routes/debugLsoService.mjs
// Debug endpoint to inspect LSO Service API responses

/**
 * Check if request is authorized (localhost or valid X-Internal-Token)
 */
function isAuthorized(request, env) {
  const host = new URL(request.url).hostname;
  if (host === "127.0.0.1" || host === "localhost") return true;
  const token = request.headers.get("x-internal-token");
  const expected = env.INTERNAL_SCAN_TOKEN;
  return expected && token && token === expected;
}

/**
 * Fetch with timeout to prevent hanging
 */
function fetchWithTimeout(url, timeoutMs = 15000) {
  return Promise.race([
    fetch(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Fetch timeout")), timeoutMs)
    ),
  ]);
}

/**
 * Trim long strings to prevent bloat in response
 */
function trimString(str, maxLen = 200) {
  if (typeof str !== "string") return str;
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + `... [${str.length} total chars]`;
}

/**
 * Recursively collect all top-level keys from objects in an array
 */
function collectKeys(items, maxSample = 5) {
  const keys = new Set();
  const itemsToCheck = Array.isArray(items)
    ? items.slice(0, maxSample)
    : [items];

  for (const item of itemsToCheck) {
    if (item && typeof item === "object") {
      Object.keys(item).forEach((k) => keys.add(k));
    }
  }

  return Array.from(keys).sort();
}

/**
 * Trim sample items to keep response size reasonable
 */
function trimSample(items, limit = 10) {
  const trimmed = items.slice(0, limit);
  return trimmed.map((item) => {
    if (typeof item !== "object" || item === null) return item;
    const trimmedItem = {};
    for (const [key, value] of Object.entries(item)) {
      if (typeof value === "string") {
        trimmedItem[key] = trimString(value, 200);
      } else {
        trimmedItem[key] = value;
      }
    }
    return trimmedItem;
  });
}

/**
 * Attempt to extract array from response
 * Handles both direct arrays and objects with array fields
 */
function extractArray(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (typeof data === "object" && data !== null) {
    // Try common field names
    for (const fieldName of ["data", "results", "items", "records", "bills"]) {
      if (Array.isArray(data[fieldName])) {
        return data[fieldName];
      }
    }
  }

  return null;
}

/**
 * GET /api/internal/debug/lso/billinformation-sample
 * Query params: year (required), limit (optional, default 10, max 20)
 */
export async function handleDebugLsoSample(request, env) {
  console.log("[LSO_DEBUG] handleDebugLsoSample called");

  // Authorization check
  if (!isAuthorized(request, env)) {
    console.log("[LSO_DEBUG] Authorization failed");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(request.url);
    const year = url.searchParams.get("year");
    let limit = parseInt(url.searchParams.get("limit")) || 10;

    // Validate inputs
    if (!year) {
      return new Response(
        JSON.stringify({ error: "Missing required param: year" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Cap limit
    if (limit < 1) limit = 1;
    if (limit > 20) limit = 20;

    console.log("[LSO_DEBUG] Fetching year=" + year + ", limit=" + limit);

    // Fetch from LSO Service
    const sourceUrl =
      "https://web.wyoleg.gov/LsoService/api/BillInformation?searchValue=" +
      encodeURIComponent(year);
    console.log("[LSO_DEBUG] Source URL: " + sourceUrl);

    let response;
    try {
      response = await fetchWithTimeout(sourceUrl, 15000);
    } catch (err) {
      console.log("[LSO_DEBUG] Fetch error: " + err.message);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch LSO Service",
          message: err.message,
          source_url: sourceUrl,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const text = await response.text();
      console.log(
        "[LSO_DEBUG] HTTP " +
          response.status +
          ": " +
          text.substring(0, 200)
      );
      return new Response(
        JSON.stringify({
          error: "LSO Service returned error",
          status: response.status,
          body_preview: text.substring(0, 200),
          source_url: sourceUrl,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse JSON
    let data;
    try {
      data = await response.json();
    } catch (err) {
      const text = await response.text();
      console.log("[LSO_DEBUG] JSON parse error: " + err.message);
      return new Response(
        JSON.stringify({
          error: "Failed to parse LSO Service response as JSON",
          message: err.message,
          body_preview: text.substring(0, 200),
          source_url: sourceUrl,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract array
    let items = extractArray(data);
    let notes = [];

    if (!items) {
      console.log("[LSO_DEBUG] Could not extract array from response");
      notes.push("Response was not an array or object with array field");
      items = [];
    }

    console.log("[LSO_DEBUG] Got " + items.length + " items");

    // Filter by year if the items have a year field
    const filteredItems = items.filter((item) => {
      if (typeof item === "object" && item !== null && item.year) {
        return String(item.year) === String(year);
      }
      return true;
    });

    if (filteredItems.length < items.length) {
      notes.push(
        "Filtered " +
          items.length +
          " items to " +
          filteredItems.length +
          " by year field"
      );
    }

    // Get keys from all items (not just sample)
    const keysObserved = collectKeys(
      filteredItems.length > 0 ? filteredItems : items,
      Math.min(5, (filteredItems.length > 0 ? filteredItems : items).length)
    );

    // Get sample
    const sampleItems = trimSample(
      filteredItems.length > 0 ? filteredItems : items,
      limit
    );

    const result = {
      year: year,
      source_url: sourceUrl,
      total_items_received:
        filteredItems.length > 0 ? filteredItems.length : items.length,
      total_items_before_filter: items.length,
      sample_items: sampleItems,
      keys_observed: keysObserved,
      sample_count: sampleItems.length,
      notes: notes.length > 0 ? notes : undefined,
    };

    console.log("[LSO_DEBUG] Success: " + result.total_items_received + " items");
    return new Response(JSON.stringify(result, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.log("[LSO_DEBUG] Unexpected error: " + err.message);
    return new Response(
      JSON.stringify({
        error: "Unexpected error",
        message: err.message,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
