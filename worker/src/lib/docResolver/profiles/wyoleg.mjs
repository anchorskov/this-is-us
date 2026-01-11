// worker/src/lib/docResolver/profiles/wyoleg.mjs
// Profile for Wyoming Legislature (wyoleg.gov) bill documents

const BASE = ["https://wyoleg.gov", "https://www.wyoleg.gov"];

export const baseUrls = BASE;

export const candidates = [
  { kind: "pdf", template: "/{year}/Introduced/{bill}.pdf", priority: 1 },
  { kind: "pdf", template: "/{year}/Enroll/{bill}.pdf", priority: 2 },
  { kind: "pdf", template: "/{year}/Digest/{bill}.pdf", priority: 3 },
  { kind: "pdf", template: "/{year}/Fiscal/{bill}.pdf", priority: 4 },
];

export const checkpoints = [
  {
    kind: "html",
    template: "/Legislation/{year}/{bill}",
    parserKind: "page",
    priority: 10,
  },
  {
    kind: "html",
    template: "/Legislation/Amendment/{year}?billNumber={bill}",
    parserKind: "amendment-links",
    priority: 20,
  },
];

export const parsers = {
  amendments(html = "") {
    const links = [];
    const regex = /href="([^"]*Amends[^"]*\.pdf)"/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const raw = match[1];
      if (raw.startsWith("http")) {
        links.push(raw);
      } else {
        // normalize relative links
        links.push(`https://wyoleg.gov${raw.startsWith("/") ? raw : `/${raw}`}`);
      }
    }
    return Array.from(new Set(links));
  },
};

export const validate = {
  isSpaShell(html = "") {
    const lower = html.toLowerCase();
    return lower.includes("<app-root") || lower.includes("ng-version");
  },
};
