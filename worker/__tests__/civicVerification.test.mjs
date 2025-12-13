import { jest } from "@jest/globals";
import { verifyBillWithMiniModel } from "../src/lib/civicVerification.mjs";

const baseBill = {
  id: "test-bill",
  bill_number: "HB 1",
  title: "An Act relating to testing",
  source: "open_states",
  jurisdiction_key: "WY",
};

const env = { OPENAI_API_KEY: "test-key" };

const okModelPayload = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          openai_topics: ["test-topic"],
          topic_match: true,
          summary_safe: true,
          issues: [],
          confidence: 0.9,
        }),
      },
    },
  ],
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => okModelPayload,
  });
});

afterEach(() => {
  jest.resetAllMocks();
});

test("returns ok only when Wyoming bill has summary, sponsor, and model passes", async () => {
  const result = await verifyBillWithMiniModel(env, {
    bill: baseBill,
    aiSummary: "Plain summary is present.",
    storedTopic: "test-topic",
    hotTopics: [],
    hasWyomingSponsor: true,
  });

  expect(result.status).toBe("ok");
  expect(result.structural_ok).toBe(true);
  expect(result.structural_reason).toBeNull();
  expect(result.has_wyoming_sponsor).toBe(true);
  expect(result.is_wyoming).toBe(true);
  expect(result.has_summary).toBe(true);
});

test("flags missing summary even if model matches", async () => {
  const result = await verifyBillWithMiniModel(env, {
    bill: baseBill,
    aiSummary: "",
    storedTopic: "test-topic",
    hotTopics: [],
    hasWyomingSponsor: true,
  });

  expect(result.status).toBe("flagged");
  expect(result.structural_ok).toBe(false);
  expect(result.structural_reason).toBe("missing_summary");
  expect(result.issues).toContain("missing_summary");
});

test("flags missing Wyoming sponsor", async () => {
  const result = await verifyBillWithMiniModel(env, {
    bill: baseBill,
    aiSummary: "Summary present",
    storedTopic: "test-topic",
    hotTopics: [],
    hasWyomingSponsor: false,
  });

  expect(result.status).toBe("flagged");
  expect(result.structural_reason).toBe("no_wyoming_sponsor");
  expect(result.issues).toContain("no_wyoming_sponsor");
});

test("flags wrong jurisdiction bills", async () => {
  const result = await verifyBillWithMiniModel(env, {
    bill: { ...baseBill, jurisdiction_key: "UT" },
    aiSummary: "Summary present",
    storedTopic: "test-topic",
    hotTopics: [],
    hasWyomingSponsor: true,
  });

  expect(result.status).toBe("flagged");
  expect(result.structural_ok).toBe(false);
  expect(result.structural_reason).toBe("wrong_jurisdiction");
  expect(result.issues).toContain("wrong_jurisdiction");
});
