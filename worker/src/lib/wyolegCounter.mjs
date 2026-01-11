// worker/src/lib/wyolegCounter.mjs
// Wyoming Legislative Service (LSO) bill counting via official API
// Source: https://web.wyoleg.gov/LsoService/api/BillInformation

/**
 * Count bills via Wyoming Legislative Service official API
 * @param {string} year - Legislative session year (e.g., "2025")
 * @returns {Promise<{total: number|null, method: string, sampleBills: string[], error?: string}>}
 */
export async function countBillsViaLsoService(year) {
  try {
    console.log(`[LSO] Attempting to count bills for year: ${year}`);

    // Try with searchValue first
    const countWithSearch = await tryCountWithSearch(year);
    if (countWithSearch.total !== null) {
      return countWithSearch;
    }

    // Fall back to getting all and filtering by year
    const countAll = await tryCountAll(year);
    if (countAll.total !== null) {
      return countAll;
    }

    // Both failed
    return {
      total: null,
      method: 'lsoService_failed',
      sampleBills: [],
      error: 'Unable to count bills from LSO Service API'
    };
  } catch (error) {
    console.error('[LSO] Unexpected error:', error.message);
    return {
      total: null,
      method: 'lsoService_failed',
      sampleBills: [],
      error: `LSO Service error: ${error.message}`
    };
  }
}

/**
 * Try counting bills with searchValue parameter
 */
async function tryCountWithSearch(year) {
  try {
    const url = `https://web.wyoleg.gov/LsoService/api/BillInformation?searchValue=${encodeURIComponent(year)}`;
    console.log(`[LSO] Fetching with searchValue: ${year}`);

    const response = await fetchWithTimeout(url, 15000);
    if (!response.ok) {
      console.warn(`[LSO] Search request failed: ${response.status}`);
      return { total: null, method: null, sampleBills: [] };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      console.warn(`[LSO] Non-JSON response (${contentType})`);
      return { total: null, method: null, sampleBills: [] };
    }

    const data = await response.json();

    // Extract items and filter by year (searchValue returns multiple years)
    const items = getItemsList(data);
    if (!items || items.length === 0) {
      console.warn('[LSO] No items found in search response');
      return { total: null, method: null, sampleBills: [] };
    }

    const billNumbers = new Set();
    for (const item of items) {
      // Filter by year - searchValue returns historical data
      if (item.year && String(item.year) !== String(year)) {
        continue;
      }

      const billNum = extractBillNumber(item);
      if (billNum) {
        billNumbers.add(billNum);
      }
    }

    if (billNumbers.size > 0) {
      const sample = Array.from(billNumbers).slice(0, 10);
      console.log(`[LSO] Found ${billNumbers.size} bills via searchValue (year-filtered). Sample: ${sample.join(', ')}`);
      return {
        total: billNumbers.size,
        method: 'lsoService_search',
        sampleBills: sample
      };
    }

    return { total: null, method: null, sampleBills: [] };
  } catch (error) {
    console.warn(`[LSO] Search method failed: ${error.message}`);
    return { total: null, method: null, sampleBills: [] };
  }
}

/**
 * Try counting all bills and filtering by year
 */
async function tryCountAll(year) {
  try {
    const url = 'https://web.wyoleg.gov/LsoService/api/BillInformation';
    console.log(`[LSO] Fetching all bills from LSO Service`);

    const response = await fetchWithTimeout(url, 15000);
    if (!response.ok) {
      console.warn(`[LSO] All bills request failed: ${response.status}`);
      return { total: null, method: null, sampleBills: [] };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      console.warn(`[LSO] Non-JSON response (${contentType})`);
      return { total: null, method: null, sampleBills: [] };
    }

    const data = await response.json();

    // Extract bills and filter by year
    const items = getItemsList(data);
    if (!items || items.length === 0) {
      console.warn('[LSO] No items found in response');
      return { total: null, method: null, sampleBills: [] };
    }

    const billNumbers = new Set();
    for (const item of items) {
      // Check if item matches the requested year
      if (item.year && String(item.year) !== String(year)) {
        continue;
      }

      // Extract bill number
      const billNum = extractBillNumber(item);
      if (billNum) {
        billNumbers.add(billNum);
      }
    }

    if (billNumbers.size > 0) {
      const sample = Array.from(billNumbers).slice(0, 10);
      console.log(`[LSO] Found ${billNumbers.size} bills via all list. Sample: ${sample.join(', ')}`);
      return {
        total: billNumbers.size,
        method: 'lsoService_all',
        sampleBills: sample
      };
    }

    // If no year filtering worked, assume all items are for the session
    if (items.length > 0) {
      const allBills = new Set();
      for (const item of items) {
        const billNum = extractBillNumber(item);
        if (billNum) {
          allBills.add(billNum);
        }
      }

      if (allBills.size > 0) {
        const sample = Array.from(allBills).slice(0, 10);
        console.log(`[LSO] Found ${allBills.size} bills (no year filter). Sample: ${sample.join(', ')}`);
        return {
          total: allBills.size,
          method: 'lsoService_all_unfiltered',
          sampleBills: sample
        };
      }
    }

    return { total: null, method: null, sampleBills: [] };
  } catch (error) {
    console.warn(`[LSO] All bills method failed: ${error.message}`);
    return { total: null, method: null, sampleBills: [] };
  }
}

/**
 * Extract unique bill numbers from API response
 */
function extractBillNumbers(data) {
  const billNumbers = new Set();

  // Handle array response
  if (Array.isArray(data)) {
    for (const item of data) {
      const billNum = extractBillNumber(item);
      if (billNum) {
        billNumbers.add(billNum);
      }
    }
    return { billNumbers, count: billNumbers.size };
  }

  // Handle object response with list field
  const items = getItemsList(data);
  if (items) {
    for (const item of items) {
      const billNum = extractBillNumber(item);
      if (billNum) {
        billNumbers.add(billNum);
      }
    }
  }

  return { billNumbers, count: billNumbers.size };
}

/**
 * Get items list from various response formats
 */
function getItemsList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (typeof data !== 'object' || data === null) {
    return null;
  }

  // Try common field names for list data
  for (const fieldName of ['data', 'results', 'items', 'bills', 'value']) {
    if (Array.isArray(data[fieldName])) {
      return data[fieldName];
    }
  }

  return null;
}

/**
 * Extract bill number from item object (handles field name variations)
 */
function extractBillNumber(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  // Try common field names (billNum is from LSO Service API)
  for (const fieldName of ['billNum', 'bill', 'billNumber', 'bill_number', 'billId', 'bill_id', 'number']) {
    const value = item[fieldName];
    if (value && typeof value === 'string' && value.trim()) {
      return value.trim().toUpperCase();
    }
  }

  return null;
}

/**
 * Fetch with timeout
 */
function fetchWithTimeout(url, timeoutMs) {
  return Promise.race([
    fetch(url, {
      headers: { 'Accept': 'application/json' }
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Fetch timeout')), timeoutMs)
    )
  ]);
}
