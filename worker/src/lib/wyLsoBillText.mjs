// worker/src/lib/wyLsoBillText.mjs
// Lightweight helper to discover official LSO bill page + PDF link.
// This does NOT download or store bill text; it only finds the URLs.

import { wyUrlForBill, normalizeBillNumberWy } from "./wyLsoClient.mjs";

/**
 * Fetch the public LSO bill page and attempt to locate a linked PDF.
 * Fails softly: if anything goes wrong, returns the canonical bill page URL and a null pdfUrl.
 *
 * @param {Env} env Cloudflare Worker environment (not currently used)
 * @param {Object} civicItem Row from civic_items with at least {id, bill_number, legislative_session, source}
 * @returns {Promise<{billUrl: string|null, pdfUrl: string|null}>}
 */
export async function fetchLsoBillTextMetadata(env, civicItem = {}) {
  if (!civicItem.id) throw new Error("civicItem.id is required");
  if (civicItem.source !== "lso") {
    throw new Error(`fetchLsoBillTextMetadata only supports source='lso' (got ${civicItem.source})`);
  }

  const billNum = normalizeBillNumberWy(
    civicItem.external_ref_id || civicItem.bill_number || civicItem.id
  );
  const year = civicItem.legislative_session || new Date().getFullYear();
  const billUrl = billNum ? wyUrlForBill(year, billNum) : null;
  let pdfUrl = null;

  if (!billUrl) {
    console.warn(`⚠️  Unable to build LSO bill URL for ${civicItem.id}`);
    return { billUrl: null, pdfUrl: null };
  }

  try {
    const res = await fetch(billUrl);
    if (!res.ok) {
      console.warn(
        `⚠️  LSO bill page fetch failed for ${billNum}: ${res.status} ${await res.text()}`
      );
      return { billUrl, pdfUrl: null };
    }
    const html = await res.text();

    // Look for the first .pdf link in the page
    const hrefMatch =
      html.match(/href="([^"]+\\.pdf)"/i) ||
      html.match(/https?:[^"']+\\.pdf/i);
    if (hrefMatch) {
      let href = hrefMatch[1] || hrefMatch[0];
      if (href.startsWith("//")) {
        href = `https:${href}`;
      } else if (href.startsWith("/")) {
        href = new URL(billUrl).origin + href;
      } else if (!href.startsWith("http")) {
        href = new URL(href, billUrl).href;
      }
      pdfUrl = href;
    } else {
      console.warn(`ℹ️  No PDF link found on ${billUrl} (searched for .pdf)`);
    }
  } catch (err) {
    console.warn(`⚠️  Error fetching LSO bill page for ${billNum}: ${err.message}`);
  }

  return { billUrl, pdfUrl };
}

/**
 * Derive the best text URL and source label from BillInformation payload.
 * @param {Object} billInfo BillInformation response
 * @param {string} billInfoUrl Optional URL used to fetch BillInformation (fallback for html source)
 * @returns {{ textUrl: string, source: 'pdf'|'html'|'none', missingPdf: boolean, missingHtml: boolean }}
 */
export function resolveLsoTextUrl(billInfo = {}, billInfoUrl = "") {
  const result = { textUrl: "unavailable", source: "none", missingPdf: true, missingHtml: true };
  if (!billInfo || typeof billInfo !== "object") return result;

  const showPdf = billInfo.ShowPDF === true || billInfo.ShowPDF === "true";
  const pdfFields = [
    billInfo.EngrossedVersion,
    billInfo.EnrolledAct,
    billInfo.Digest,
    billInfo.FiscalNote,
  ].filter(Boolean);

  const findUid = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    if (obj.uid || obj.Uid || obj.UID) return obj.uid || obj.Uid || obj.UID;
    if (obj.fileUid || obj.FileUid || obj.FileUID) return obj.fileUid || obj.FileUid || obj.FileUID;
    if (obj.id || obj.Id || obj.ID) return obj.id || obj.Id || obj.ID;
    if (obj.path || obj.Path) return obj.path || obj.Path;
    return null;
  };

  if (showPdf) {
    for (const candidate of pdfFields) {
      const uid = findUid(candidate);
      if (uid) {
        result.textUrl = `https://web.wyoleg.gov/LsoService/api/File/GetFile/${uid}`;
        result.source = "pdf";
        result.missingPdf = false;
        return result;
      }
      // Look for direct .pdf path
      const str = typeof candidate === "string" ? candidate : null;
      if (str && str.toLowerCase().includes(".pdf")) {
        result.textUrl = str.startsWith("http")
          ? str
          : `https://web.wyoleg.gov/${str.replace(/^\\/, "")}`;
        result.source = "pdf";
        result.missingPdf = false;
        return result;
      }
    }
  }

  const html = billInfo.CurrentBillHTML || billInfo.BillHTML || "";
  if (html) {
    result.textUrl = billInfoUrl || "unavailable";
    result.source = "html";
    result.missingHtml = false;
    return result;
  }

  return result;
}

export default fetchLsoBillTextMetadata;
