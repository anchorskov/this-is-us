import { buildCivicItemFromLso, normalizeBillNumberWy } from "../src/lib/wyLsoClient.mjs";

describe("normalizeBillNumberWy", () => {
  test("pads and uppercases bill numbers", () => {
    expect(normalizeBillNumberWy("hb8")).toBe("HB0008");
    expect(normalizeBillNumberWy("SF 12")).toBe("SF0012");
  });
});

describe("buildCivicItemFromLso", () => {
  test("maps core fields from LSO bill", () => {
    const civic = buildCivicItemFromLso({
      billNum: "HB0008",
      shortTitle: "Stalking of minors.",
      sponsor: "Judiciary",
      year: 2026,
      billStatus: null,
      lastAction: null,
      lastActionDate: null,
    });

    expect(civic.id).toBe("HB0008");
    expect(civic.bill_number).toBe("HB0008");
    expect(civic.title).toContain("Stalking");
    expect(civic.source).toBe("lso");
    expect(civic.jurisdiction_key).toBe("WY");
    expect(civic.legislative_session).toBe("2026");
    expect(civic.external_url).toContain("wyoleg.gov");
  });
});
