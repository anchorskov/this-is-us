// worker/src/lib/docResolver/index.mjs
// Dynamic document resolver with source profiles (initial: wyoleg)

import * as wyoleg from "./profiles/wyoleg.mjs";

const PROFILES = {
  wyoleg,
};

function isPdfContentType(headers = new Headers()) {
  const ct = headers.get("content-type") || "";
  return ct.toLowerCase().includes("application/pdf");
}

function looksLikeSpaShell(html = "") {
  const lower = html.toLowerCase();
  return (
    lower.includes("<app-root") ||
    lower.includes("ng-version") ||
    lower.includes("angular") ||
    lower.includes("<script src=\"main") ||
    lower.includes("<script src=\"runtime")
  );
}

async function tryFetch(url, { kind, debug }) {
  const tried = { url, kind, method: "HEAD", status: null, error: null, ok: false };
  try {
    const headRes = await fetch(url, { method: "HEAD" });
    tried.status = headRes.status;
    tried.ok = headRes.ok;
    tried.headers = headRes.headers;
    tried.pdf = isPdfContentType(headRes.headers);
    if (headRes.ok) return { res: headRes, tried };
  } catch (err) {
    tried.error = err.message;
  }

  const getTried = { ...tried, method: "GET" };
  try {
    const getRes = await fetch(url, { method: "GET", redirect: "follow" });
    getTried.status = getRes.status;
    getTried.ok = getRes.ok;
    getTried.headers = getRes.headers;
    getTried.pdf = isPdfContentType(getRes.headers);
    return { res: getRes, tried: getTried };
  } catch (err) {
    getTried.error = err.message;
    if (debug) console.log("❌ GET failed", url, err);
    return { res: null, tried: getTried };
  }
}

export async function resolveDocument(env, { sourceKey, year, billNumber, debug = false }) {
  const profile = PROFILES[sourceKey];
  if (!profile) throw new Error(`Unknown sourceKey: ${sourceKey}`);

  const candidates = [];
  for (const base of profile.baseUrls) {
    for (const cand of profile.candidates) {
      const url = cand.template.replace("{year}", year).replace("{bill}", billNumber);
      candidates.push({ ...cand, url: `${base}${url}` });
    }
  }

  const tried = [];
  const discovered = [];
  const errors = [];

  // Try direct candidates
  for (const cand of candidates.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))) {
    const { res, tried: attempt } = await tryFetch(cand.url, { kind: cand.kind, debug });
    tried.push(attempt);
    if (!res || !res.ok) continue;
    if (cand.kind === "pdf" && !isPdfContentType(res.headers)) continue;
    if (cand.kind === "html") {
      const text = await res.text();
      if (profile.validate && profile.validate.isSpaShell?.(text)) continue;
    }
    return {
      best: { url: cand.url, kind: cand.kind, sourceKind: sourceKey },
      tried,
      errors,
      discovered,
    };
  }

  // Checkpoints
  for (const cp of profile.checkpoints.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))) {
    const url = `${cp.base || profile.baseUrls[0]}${cp.template
      .replace("{year}", year)
      .replace("{bill}", billNumber)}`;
    const { res, tried: attempt } = await tryFetch(url, { kind: cp.kind, debug });
    tried.push(attempt);
    if (!res || !res.ok) continue;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html")) continue;
    const html = await res.text();
    if (profile.validate?.isSpaShell?.(html)) continue;

    if (cp.parserKind === "amendment-links" && profile.parsers?.amendments) {
      const links = profile.parsers.amendments(html);
      for (const link of links) {
        discovered.push(link);
        const { res: dRes, tried: dAttempt } = await tryFetch(link, {
          kind: "pdf",
          debug,
        });
        tried.push(dAttempt);
        if (dRes && dRes.ok && isPdfContentType(dRes.headers)) {
          return {
            best: { url: link, kind: "pdf", sourceKind: sourceKey },
            tried,
            errors,
            discovered,
          };
        }
      }
    }
  }

  return { best: null, tried, errors, discovered };
}
