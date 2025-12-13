import { resolveLsoTextUrl } from "../src/lib/wyLsoBillText.mjs";

describe("resolveLsoTextUrl", () => {
  test("prefers PDF when uid present", () => {
    const billInfo = {
      ShowPDF: true,
      EngrossedVersion: { uid: "12345" },
    };
    const res = resolveLsoTextUrl(billInfo, "http://example.com");
    expect(res.textUrl).toContain("12345");
    expect(res.source).toBe("pdf");
    expect(res.missingPdf).toBe(false);
  });

  test("falls back to html when available", () => {
    const billInfo = {
      ShowPDF: false,
      CurrentBillHTML: "<html>Test</html>",
    };
    const res = resolveLsoTextUrl(billInfo, "http://example.com/billinfo");
    expect(res.textUrl).toBe("http://example.com/billinfo");
    expect(res.source).toBe("html");
    expect(res.missingHtml).toBe(false);
  });

  test("returns unavailable when nothing present", () => {
    const res = resolveLsoTextUrl({}, "http://example.com/billinfo");
    expect(res.textUrl).toBe("unavailable");
    expect(res.source).toBe("none");
  });
});
