// worker/src/lib/fetchLsoBillHtml.mjs
// Fetch bill HTML content from Wyoming LSO Service BillInformation endpoint
// Returns structured HTML fields: currentBillHTML, digestHTML, summaryHTML, etc.

/**
 * Fetch bill HTML content from LSO Service for a given year and bill number
 * @param {string} year - Legislative session year (e.g., "2026")
 * @param {string} billNumber - Normalized bill number (e.g., "HB0011", "SF0007")
 * @returns {Promise<{currentBillHTML: string|null, digestHTML: string|null, summaryHTML: string|null, showPDF: boolean, introduced: string|null, enrolled: string|null}>}
 */
export async function fetchLsoBillHtml(year, billNumber) {
  if (!year || !billNumber) {
    console.warn(`[LSO_HTML] Missing year or billNumber: ${year}, ${billNumber}`);
    return {
      currentBillHTML: null,
      digestHTML: null,
      summaryHTML: null,
      showPDF: false,
      introduced: null,
      enrolled: null,
    };
  }

  try {
    const url = `https://web.wyoleg.gov/LsoService/api/BillInformation?searchValue=${encodeURIComponent(year)}`;
    const response = await fetch(url, { method: "GET" });

    if (!response.ok) {
      console.warn(`[LSO_HTML] LSO Service failed for year ${year}: ${response.status}`);
      return {
        currentBillHTML: null,
        digestHTML: null,
        summaryHTML: null,
        showPDF: false,
        introduced: null,
        enrolled: null,
      };
    }

    const bills = await response.json();
    if (!Array.isArray(bills)) {
      console.warn(`[LSO_HTML] LSO Service returned non-array response`);
      return {
        currentBillHTML: null,
        digestHTML: null,
        summaryHTML: null,
        showPDF: false,
        introduced: null,
        enrolled: null,
      };
    }

    // Find the matching bill
    const normalizedInput = String(billNumber).toUpperCase();
    const matchedBill = bills.find(b => {
      if (!b.billNum) return false;
      const billNum = String(b.billNum).toUpperCase();
      return billNum === normalizedInput;
    });

    if (!matchedBill) {
      console.warn(`[LSO_HTML] Bill ${billNumber} not found in LSO Service for year ${year}`);
      return {
        currentBillHTML: null,
        digestHTML: null,
        summaryHTML: null,
        showPDF: false,
        introduced: null,
        enrolled: null,
      };
    }

    // Extract HTML fields from matched bill
    return {
      currentBillHTML: matchedBill.currentBillHTML || null,
      digestHTML: matchedBill.digestHTML || null,
      summaryHTML: matchedBill.summaryHTML || null,
      showPDF: !!matchedBill.showPDF,
      introduced: matchedBill.introduced || null,
      enrolled: matchedBill.enrolled || null,
    };
  } catch (err) {
    console.warn(`[LSO_HTML] Error fetching bill HTML: ${err.message}`);
    return {
      currentBillHTML: null,
      digestHTML: null,
      summaryHTML: null,
      showPDF: false,
      introduced: null,
      enrolled: null,
    };
  }
}

/**
 * Extract plain text from LSO HTML fields
 * @param {string|null} currentBillHTML - Current bill HTML
 * @param {string|null} digestHTML - Digest HTML
 * @param {string|null} summaryHTML - Summary HTML
 * @returns {string|null} - Concatenated plain text (up to 3000 chars) or null if all empty
 */
export function extractTextFromLsoHtml(currentBillHTML, digestHTML, summaryHTML) {
  const parts = [];

  // Try currentBillHTML first (most authoritative)
  if (currentBillHTML && typeof currentBillHTML === "string") {
    const text = stripHtmlTags(currentBillHTML).trim();
    if (text.length > 100) {
      parts.push(text);
    }
  }

  // Fall back to digestHTML if currentBillHTML was too thin
  if (parts.length === 0 && digestHTML && typeof digestHTML === "string") {
    const text = stripHtmlTags(digestHTML).trim();
    if (text.length > 50) {
      parts.push(text);
    }
  }

  // Fall back to summaryHTML if both above are missing
  if (parts.length === 0 && summaryHTML && typeof summaryHTML === "string") {
    const text = stripHtmlTags(summaryHTML).trim();
    if (text.length > 50) {
      parts.push(text);
    }
  }

  // Concatenate and truncate to 3000 chars
  const combined = parts.join("\n\n").slice(0, 3000);
  return combined.length > 0 ? combined : null;
}

/**
 * Strip HTML tags from text
 * @param {string} html - HTML string
 * @returns {string} - Plain text
 */
function stripHtmlTags(html) {
  if (!html) return "";
  
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  
  // Decode HTML entities
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  };
  
  Object.entries(entities).forEach(([entity, char]) => {
    text = text.split(entity).join(char);
  });
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  
  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();
  
  return text;
}
