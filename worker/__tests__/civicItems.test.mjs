import { jest, describe, test, expect } from "@jest/globals";

// Mock dependencies before importing the module under test
const summarizeMock = jest.fn(async () => ({
  summaryText: "AI summary",
  meta: { model: "test" },
}));

await jest.unstable_mockModule("../src/lib/civicSummaries.mjs", () => ({
  summarizeCivicItem: summarizeMock,
}));

await jest.unstable_mockModule("../src/utils/cors.js", () => ({
  withCORS: (body, status = 200) => new Response(body, { status }),
}));

const { handleGetCivicItem } = await import("../src/routes/civicItems.mjs");
const { summarizeCivicItem } = await import("../src/lib/civicSummaries.mjs");

function makeRequest(id = "bill-1") {
  return {
    params: { id },
    url: `https://example.com/api/civic/items/${id}`,
  };
}

function makeDb(row, updateSpy) {
  return {
    prepare: jest.fn(() => ({
      bind: jest.fn(() => ({
        all: jest.fn(async () => ({ results: [row] })),
        run: jest.fn(async (...args) => updateSpy?.(...args)),
      })),
    })),
  };
}

describe("handleGetCivicItem", () => {
  test("returns existing summary when status is ready", async () => {
    const row = { id: "bill-1", summary_status: "ready", summary_ai: "cached summary" };
    const env = { WY_DB: makeDb(row) };

    const res = await handleGetCivicItem(makeRequest(), env);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.summary_ai).toBe("cached summary");
    expect(summarizeCivicItem).not.toHaveBeenCalled();
  });

  test("generates and updates summary when missing", async () => {
    const updateSpy = jest.fn();
    const row = { id: "bill-2", title: "Test Bill", summary_status: "missing" };
    const env = { WY_DB: makeDb(row, updateSpy), OPENAI_API_KEY: "test" };

    const res = await handleGetCivicItem(makeRequest("bill-2"), env);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.summary_ai).toBe("AI summary");
    expect(body.summary_status).toBe("ready");
    expect(summarizeCivicItem).toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalled(); // UPDATE was issued
  });
});
