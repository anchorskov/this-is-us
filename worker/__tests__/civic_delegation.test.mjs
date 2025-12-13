import { jest, describe, test, expect } from "@jest/globals";

// Mock federal delegation so we control output
const mockFederal = {
  house: { name: "Rep At-Large", role: "U.S. House (At-Large)" },
  senators: [
    { name: "Sen One", role: "U.S. Senate" },
    { name: "Sen Two", role: "U.S. Senate" },
  ],
};

await jest.unstable_mockModule("../src/lib/federalDelegation.mjs", () => ({
  federalDelegation: mockFederal,
}));

const { handleGetDelegation } = await import("../src/routes/civic/delegation.mjs");

function makeDb({ verifiedRows = [], legislators = [], cityCounty = [] } = {}) {
  return {
    prepare: jest.fn((sql) => ({
      bind: jest.fn((param) => ({
        all: jest.fn(async () => {
          if (sql.includes("FROM verified_users")) {
            return {
              results: verifiedRows.filter((r) => r.user_id === param),
            };
          }
          if (sql.includes("FROM wy_legislators") && sql.includes("chamber = 'house'")) {
            return {
              results: legislators.filter(
                (r) => r.chamber === "house" && String(r.district_number) === String(param)
              ),
            };
          }
          if (sql.includes("FROM wy_legislators") && sql.includes("chamber = 'senate'")) {
            return {
              results: legislators.filter(
                (r) => r.chamber === "senate" && String(r.district_number) === String(param)
              ),
            };
          }
          if (sql.includes("FROM voters_addr_norm")) {
            return { results: [] }; // not used in happy path
          }
          if (sql.includes("FROM wy_city_county")) {
            return { results: cityCounty.filter((c) => c.id === param) };
          }
          return { results: [] };
        }),
      })),
    })),
  };
}

describe("GET /api/civic/delegation", () => {
  test("returns delegation for verified voter", async () => {
    const env = {
      WY_DB: makeDb({
        verifiedRows: [
          {
            user_id: "test-user",
            voter_id: "V123",
            county: "Natrona",
            house: "57",
            senate: "29",
            status: "verified",
          },
        ],
        legislators: [
          {
            chamber: "house",
            district_number: "57",
            district_label: "HD-57",
            name: "Rep Test",
            contact_email: "rep@test.wy",
            contact_phone: "111-222-3333",
            website_url: "https://rep.test",
          },
          {
            chamber: "senate",
            district_number: "29",
            district_label: "SD-29",
            name: "Sen Test",
            contact_email: "sen@test.wy",
            contact_phone: "444-555-6666",
            website_url: "https://sen.test",
          },
        ],
      }),
    };

    const req = { url: "https://example.com/api/civic/delegation?user_id=test-user" };
    const res = await handleGetDelegation(req, env);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.source).toBe("verified_voter");
    expect(body.house?.name).toBe("Rep Test");
    expect(body.house?.district).toBe("57");
    expect(body.senate?.name).toBe("Sen Test");
    expect(body.senate?.district).toBe("29");
    expect(body.federal).toEqual(mockFederal);
  });

  test("returns source none when user not verified", async () => {
    const env = { WY_DB: makeDb() };
    const req = { url: "https://example.com/api/civic/delegation?user_id=unknown-user" };
    const res = await handleGetDelegation(req, env);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.source).toBe("none");
    expect(body.message).toMatch(/No verified voter record/i);
    expect(body.house).toBeNull();
    expect(body.senate).toBeNull();
  });
});
