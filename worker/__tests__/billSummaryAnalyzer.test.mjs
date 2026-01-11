import {
  analyzeBillSummary,
  analyzeBillSummaryFromTitle,
  ensureBillSummary,
  saveBillSummary,
} from "../src/lib/billSummaryAnalyzer.mjs";

// Mock constants
const MIN_TEXT_CHARS = 50;
const MIN_PDF_TEXT_CHARS = 200;
const MIN_OPENSTATES_CHARS = 100;

// Mock environment
const mockEnv = {
  OPENAI_API_KEY: "sk-test-key-12345",
  WY_DB: {
    prepare: jest.fn().mockReturnThis(),
    bind: jest.fn().mockReturnThis(),
    run: jest.fn().mockResolvedValue({ success: true }),
  },
};

// Helper to mock fetch responses
global.fetch = jest.fn();

describe("analyzeBillSummary - Fallback Ladder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  test("[1/5] Uses LSO HTML when available and thick", async () => {
    const testBill = {
      bill_number: "HB0001",
      title: "Test Bill",
      legislative_session: "2026",
    };

    // Mock LSO HTML fetch
    fetch.mockImplementationOnce((url) => {
      if (url.includes("lso.wy.gov")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({
            currentBillHTML: "<p>" + "A ".repeat(100) + "</p>",
            digestHTML: "",
            summaryHTML: "",
          }),
        });
      }
      // Mock OpenAI response
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  plain_summary: "Test summary from LSO",
                  key_points: ["Point 1"],
                  note: "ok",
                }),
              },
            },
          ],
        }),
      });
    });

    // Mock docResolver
    const mockDocResolver = jest.fn().mockResolvedValue({
      best: null,
    });
    global.resolveDocument = mockDocResolver;

    const result = await analyzeBillSummary(mockEnv, testBill);

    expect(result.source).toBe("lso_html");
    expect(result.is_authoritative).toBe(true);
    expect(result.plain_summary).toBeTruthy();
    expect(result.plain_summary.length).toBeGreaterThan(0);
  });

  test("[2/5] Falls back to text_url when LSO HTML thin", async () => {
    const testBill = {
      bill_number: "HB0002",
      title: "Test Bill",
      text_url: "https://example.com/bill.txt",
      legislative_session: "2026",
    };

    fetch.mockImplementationOnce((url) => {
      // Mock LSO HTML - empty
      if (url.includes("lso.wy.gov")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({
            currentBillHTML: "",
            digestHTML: "",
            summaryHTML: "",
          }),
        });
      }
      // Mock text_url - thick content
      if (url.includes("example.com")) {
        return Promise.resolve({
          ok: true,
          headers: { get: () => "text/plain" },
          text: async () => "A ".repeat(100),
        });
      }
      // Mock OpenAI response
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  plain_summary: "Test summary from text_url",
                  key_points: ["Point 1"],
                  note: "ok",
                }),
              },
            },
          ],
        }),
      });
    });

    const result = await analyzeBillSummary(mockEnv, testBill);

    expect(result.source).toBe("text_url");
    expect(result.is_authoritative).toBe(true);
  });

  test("[4/5] Falls back to OpenStates (non-authoritative) when other sources fail", async () => {
    const testBill = {
      bill_number: "HB0003",
      title: "Test Bill",
      legislative_session: "2026",
    };

    fetch.mockImplementation((url) => {
      // Mock LSO HTML - empty
      if (url.includes("lso.wy.gov")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({
            currentBillHTML: "",
            digestHTML: "",
            summaryHTML: "",
          }),
        });
      }
      // Mock OpenStates API
      if (url.includes("openstates.org")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            abstract: "A ".repeat(60), // Meets MIN_OPENSTATES_CHARS = 100
          }),
        });
      }
      // Mock OpenAI response
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  plain_summary: "Test summary from OpenStates",
                  key_points: ["Point 1"],
                  note: "ok",
                }),
              },
            },
          ],
        }),
      });
    });

    const result = await analyzeBillSummary(mockEnv, testBill);

    expect(result.source).toBe("openstates");
    expect(result.is_authoritative).toBe(false);
  });

  test("[5/5] Uses title-only when no text sources available", async () => {
    const testBill = {
      bill_number: "HB0004",
      title: "Test Bill Title",
      summary: "Bill summary",
      legislative_session: "2026",
    };

    fetch.mockImplementationOnce((url) => {
      // Mock LSO HTML - empty
      if (url.includes("lso.wy.gov")) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({
            currentBillHTML: "",
            digestHTML: "",
            summaryHTML: "",
          }),
        });
      }
      // Mock OpenStates API - no response
      if (url.includes("openstates.org")) {
        return Promise.resolve({
          ok: false,
        });
      }
      // Mock OpenAI response for title-only
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  plain_summary: "Test summary from title",
                  key_points: [],
                  note: "ok",
                }),
              },
            },
          ],
        }),
      });
    });

    const result = await analyzeBillSummary(mockEnv, testBill);

    expect(result.source).toBe("title_only");
    expect(result.is_authoritative).toBe(true);
  });

  test("[NO SOURCES] Returns no_text_available when all sources fail", async () => {
    const testBill = {
      bill_number: "HB0005",
      // No title, no summary, no text_url
      legislative_session: "2026",
    };

    fetch.mockImplementation((url) => {
      // Mock all sources returning empty
      return Promise.resolve({
        ok: false,
      });
    });

    const result = await analyzeBillSummary(mockEnv, testBill);

    expect(result.source).toBe("none");
    expect(result.note).toBe("no_text_available");
    expect(result.plain_summary).toBe("");
    expect(result.is_authoritative).toBe(false);
  });

  test("Never returns empty plain_summary unless error flagged", async () => {
    const testBill = {
      bill_number: "HB0006",
      title: "Test Bill",
      legislative_session: "2026",
    };

    fetch.mockImplementation((url) => {
      // Mock OpenAI returning empty summary
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  plain_summary: "", // Empty!
                  key_points: [],
                  note: "empty_summary",
                }),
              },
            },
          ],
        }),
      });
    });

    const result = await analyzeBillSummary(mockEnv, testBill);

    if (result.plain_summary === "") {
      expect(result.note).not.toBe("ok");
      expect([
        "api_error",
        "parse_error",
        "exception",
        "empty_summary",
        "no_text_available",
      ]).toContain(result.note);
    }
  });
});

describe("analyzeBillSummaryFromTitle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  test("Returns title_only source metadata", async () => {
    const testBill = {
      bill_number: "HB0010",
      title: "Stalking of minors",
      short_title: "Stalking",
    };

    fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  plain_summary: "This bill addresses stalking of minors.",
                  key_points: ["Makes stalking illegal"],
                  note: "ok",
                }),
              },
            },
          ],
        }),
      })
    );

    const result = await analyzeBillSummaryFromTitle(mockEnv, testBill);

    expect(result.source).toBe("title_only");
    expect(result.is_authoritative).toBe(true);
    expect(result.note).toBeTruthy();
    expect(result.key_points).toEqual(expect.any(Array));
  });
});

describe("saveBillSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("Persists summary with source metadata", async () => {
    const analysis = {
      plain_summary: "Test summary",
      key_points: ["Point 1"],
      note: "ok",
      source: "lso_html",
      is_authoritative: true,
    };

    await saveBillSummary(mockEnv, "bill-123", analysis);

    expect(mockEnv.WY_DB.prepare).toHaveBeenCalled();
    const prepareCall = mockEnv.WY_DB.prepare.mock.calls[0][0];
    expect(prepareCall).toContain("summary_source");
    expect(prepareCall).toContain("summary_error");
    expect(prepareCall).toContain("summary_is_authoritative");
  });

  test("Skips saving empty summaries", async () => {
    const analysis = {
      plain_summary: "",
      key_points: [],
      note: "no_text_available",
      source: "none",
      is_authoritative: false,
    };

    await saveBillSummary(mockEnv, "bill-456", analysis);

    expect(mockEnv.WY_DB.prepare).not.toHaveBeenCalled();
  });

  test("Converts is_authoritative boolean to integer", async () => {
    const analysis = {
      plain_summary: "Summary",
      key_points: [],
      note: "ok",
      source: "openstates",
      is_authoritative: false, // Should convert to 0
    };

    await saveBillSummary(mockEnv, "bill-789", analysis);

    const bindCall = mockEnv.WY_DB.bind.mock.calls[0];
    expect(bindCall).toContain(0); // 0 for false
  });
});

describe("ensureBillSummary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  test("Returns cached summary with source metadata", async () => {
    const cachedBill = {
      bill_number: "HB0020",
      ai_summary: "Cached summary",
      ai_key_points: '["Point 1"]',
      ai_summary_generated_at: "2025-01-01T00:00:00Z",
      summary_source: "lso_html",
      summary_error: "ok",
      summary_is_authoritative: 1,
    };

    const result = await ensureBillSummary(mockEnv, cachedBill);

    expect(result.plain_summary).toBe("Cached summary");
    expect(result.source).toBe("lso_html");
    expect(result.is_authoritative).toBe(true);
    expect(result.note).toBe("ok");
    expect(fetch).not.toHaveBeenCalled(); // No fetch for cached
  });

  test("Generates new summary if not cached", async () => {
    const freshBill = {
      bill_number: "HB0021",
      title: "Fresh Bill",
      legislative_session: "2026",
      id: "fresh-123",
      // No ai_summary (not cached)
    };

    fetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  plain_summary: "Fresh summary",
                  key_points: ["Fresh point"],
                  note: "ok",
                }),
              },
            },
          ],
        }),
      })
    );

    const result = await ensureBillSummary(mockEnv, freshBill);

    expect(result.plain_summary).toBe("Fresh summary");
    expect(mockEnv.WY_DB.prepare).toHaveBeenCalled(); // saveBillSummary called
  });

  test("Handles test injection via TEST_SUMMARY_RESPONSES", async () => {
    const testBill = {
      bill_number: "HB0022",
      id: "test-injected",
    };

    const testEnv = {
      ...mockEnv,
      TEST_SUMMARY_RESPONSES: {
        HB0022: {
          plain_summary: "Injected summary",
          key_points: ["Injected point"],
          note: "ok",
          source: "test",
          is_authoritative: true,
        },
      },
    };

    const result = await ensureBillSummary(testEnv, testBill);

    expect(result.plain_summary).toBe("Injected summary");
    expect(result.source).toBe("test");
  });
});
