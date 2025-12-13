import { isCivicItemComplete } from "../src/lib/civicItemCompleteness.mjs";

const baseItem = {
  id: "HB0008",
  bill_number: "HB0008",
  title: "Stalking of minors.",
  ai_summary: "Creates stalking protections for minors.",
  jurisdiction_key: "WY",
  level: "statewide",
  legislative_session: "2026",
  status: "draft_committee",
  external_url: "https://wyoleg.gov/Legislation/2026/HB0008",
};

describe("isCivicItemComplete", () => {
  test("returns true when all required fields and sponsor are present", () => {
    const ok = isCivicItemComplete(baseItem, { sponsorCount: 1 });
    expect(ok).toBe(true);
  });

  test("fails when sponsor missing", () => {
    const ok = isCivicItemComplete(baseItem, { sponsorCount: 0 });
    expect(ok).toBe(false);
  });

  test("fails when summary missing", () => {
    const ok = isCivicItemComplete(
      { ...baseItem, ai_summary: "" },
      { sponsorCount: 1 }
    );
    expect(ok).toBe(false);
  });

  test("fails when jurisdiction not WY", () => {
    const ok = isCivicItemComplete(
      { ...baseItem, jurisdiction_key: "UT" },
      { sponsorCount: 1 }
    );
    expect(ok).toBe(false);
  });
});
