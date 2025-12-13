/**
 * __tests__/pending-bill-sponsors.test.js
 * Verify sponsor rendering helpers used on pending bills page.
 */

import { buildSponsorLine, buildSponsorBlock } from "../static/js/civic/pending-bills.js";

describe("buildSponsorLine", () => {
  test("formats up to two sponsors", () => {
    const sponsors = [{ name: "Rep. Jane Doe" }, { name: "Sen. John Smith" }];
    expect(buildSponsorLine(sponsors)).toBe("Sponsored by Rep. Jane Doe, Sen. John Smith");
  });

  test("returns empty string when no sponsors", () => {
    expect(buildSponsorLine([])).toBe("");
    expect(buildSponsorLine(null)).toBe("");
  });
});

describe("buildSponsorBlock", () => {
  test("renders contact link when website is present", () => {
    const bill = {
      sponsors: [
        {
          name: "Rep. Jane Doe",
          contact_website: "https://example.com",
        },
      ],
    };
    const html = buildSponsorBlock(bill);
    expect(html).toContain("Sponsored by Rep. Jane Doe");
    expect(html).toContain('href="https://example.com"');
  });

  test("renders fallback when no sponsors", () => {
    const html = buildSponsorBlock({ sponsors: [] });
    expect(html).toContain("Sponsor info not available yet");
  });
});
