export async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);

    // network‐OK but HTTP error
    if (!res.ok) {
      let errMsg = `Server responded with ${res.status}`;
      try {
        const body = await res.json();
        errMsg = body.message || errMsg;
      } catch {
        // non‐JSON error payload
      }
      throw new Error(errMsg);
    }

    // success path: parse JSON (or return text if you prefer)
    return await res.json();
  }
  catch (err) {
    // rethrow so callers can catch, or let global unhandledRejection fire
    throw err;
  }
}
