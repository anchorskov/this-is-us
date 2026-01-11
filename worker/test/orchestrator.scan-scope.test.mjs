// worker/test/orchestrator.scan-scope.test.js
// Validates orchestrator scan scope, summary persistence rules, and skip handling.

import { jest } from "@jest/globals";

// Mock heavy dependencies to avoid real OpenAI/doc fetches
jest.unstable_mockModule("../src/lib/hotTopicsAnalyzer.mjs", () => ({
  analyzeBillForHotTopics: jest.fn().mockResolvedValue({ topics: [], other_flags: [] }),
  saveHotTopicAnalysis: jest.fn().mockResolvedValue(undefined),
  buildUserPromptTemplate: jest.fn().mockReturnValue("prompt"),
  getSinglePendingBill: jest.fn(),
}));

jest.unstable_mockModule("../src/lib/docResolver/index.mjs", () => ({
  resolveDocument: jest.fn().mockResolvedValue({
    best: { url: "https://example.com/doc.pdf", kind: "pdf" },
  }),
}));

const { runAdminScan } = await import("../src/routes/civicScan.mjs");

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  async all() {
    return { results: this._execSelect() };
  }

  async first() {
    const { results } = await this.all();
    return results[0] || null;
  }

  async run() {
    this._execRun();
    return { success: true };
  }

  _execSelect() {
    if (this.sql.includes("FROM civic_item_sources")) {
      return [];
    }
    if (this.sql.includes("FROM civic_items ci")) {
      return this._selectScanCandidates();
    }
    if (this.sql.includes("FROM civic_items")) {
      return this._selectById();
    }
    return [];
  }

  _selectById() {
    const [id, ...statuses] = this.args;
    return this.db.items
      .filter(
        (item) =>
          item.id === id &&
          statuses.includes(item.status) &&
          (item.inactive_at === null || item.inactive_at === undefined)
      )
      .map((item) => ({ ...item }));
  }

  _selectScanCandidates() {
    const statuses = this.args.slice(0, 3);
    let idx = 3;
    let year = null;
    if (this.args.length >= 7) {
      year = this.args[idx];
      idx += 1;
    }
    const forceFlag = this.args[idx] === 1;
    const limit = this.args[idx + 2];

    const filtered = this.db.items.filter((item) => {
      const active = item.inactive_at === null || item.inactive_at === undefined;
      const statusOk = statuses.includes(item.status);
      const yearOk = year ? item.legislative_session === String(year) : true;
      const metaOk =
        item.level === "statewide" &&
        item.jurisdiction_key === "WY" &&
        item.source === "lso";
      const tagClause = forceFlag ? true : true; // no tag data in test fixture
      return active && statusOk && yearOk && metaOk && tagClause;
    });

    return filtered.slice(0, limit).map((item) => ({
      ...item,
      tag_count: 0,
      last_tag_at: null,
    }));
  }

  _execRun() {
    // Handle updates to civic_items (summary persistence)
    if (this.sql.startsWith("UPDATE civic_items")) {
      const [summary, keyPointsJson, id] = this.args;
      const item = this.db.items.find((row) => row.id === id);
      if (item) {
        item.ai_summary = summary;
        item.ai_key_points = keyPointsJson;
        item.ai_summary_generated_at = "now";
      }
    }
  }
}

class FakeDB {
  constructor(items) {
    this.items = items;
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
}

describe("Orchestrator scan scope and summary handling", () => {
  const bill2026ActiveA = {
    id: "bill-2026-a",
    bill_number: "HB 1",
    title: "Education funding",
    status: "introduced",
    legislative_session: "2026",
    level: "statewide",
    jurisdiction_key: "WY",
    source: "lso",
    inactive_at: null,
    ai_summary: null,
    ai_key_points: null,
  };
  const bill2026ActiveB = {
    id: "bill-2026-b",
    bill_number: "HB 2",
    title: "Healthcare reform",
    status: "in_committee",
    legislative_session: "2026",
    level: "statewide",
    jurisdiction_key: "WY",
    source: "lso",
    inactive_at: null,
    ai_summary: null,
    ai_key_points: null,
  };
  const bill2026Inactive = {
    id: "bill-2026-inactive",
    bill_number: "HB 3",
    title: "Inactive bill",
    status: "introduced",
    legislative_session: "2026",
    level: "statewide",
    jurisdiction_key: "WY",
    source: "lso",
    inactive_at: "2025-12-01T00:00:00Z",
    ai_summary: null,
    ai_key_points: null,
  };
  const bill2025 = {
    id: "bill-2025",
    bill_number: "HB 4",
    title: "Older session bill",
    status: "introduced",
    legislative_session: "2025",
    level: "statewide",
    jurisdiction_key: "WY",
    source: "lso",
    inactive_at: null,
    ai_summary: null,
    ai_key_points: null,
  };

  function createEnv() {
    const db = new FakeDB([
      bill2026ActiveA,
      bill2026ActiveB,
      bill2026Inactive,
      bill2025,
    ]);
    return {
      WY_DB: db,
      BILL_SCANNER_ENABLED: "true",
      OPENAI_API_KEY: "test-key",
      TEST_SKIP_RESOLVE: "true",
      TEST_SUMMARY_RESPONSES: {
        "HB 1": { plain_summary: "", key_points: [], note: "need_more_text" },
        "HB 2": { plain_summary: "Valid summary text", key_points: ["point"], note: "ok" },
      },
    };
  }

  it("scans only active 2026 items and handles summary outcomes", async () => {
    const env = createEnv();

    const result = await runAdminScan(env, { year: "2026", batchSize: 10 });

    expect(result.scanned).toBe(2);
    const scannedBills = result.results.map((r) => r.bill_number).sort();
    expect(scannedBills).toEqual(["HB 1", "HB 2"]);
    expect(result.summaries_written).toBe(1);
    expect(result.summaries_skipped).toBe(1);

    const updatedA = env.WY_DB.items.find((b) => b.id === "bill-2026-a");
    const updatedB = env.WY_DB.items.find((b) => b.id === "bill-2026-b");
    const untouchedInactive = env.WY_DB.items.find((b) => b.id === "bill-2026-inactive");
    const untouched2025 = env.WY_DB.items.find((b) => b.id === "bill-2025");

    expect(updatedA.ai_summary).toBeFalsy();
    expect(updatedB.ai_summary).toBe("Valid summary text");
    expect(untouchedInactive.ai_summary).toBeNull();
    expect(untouched2025.ai_summary).toBeNull();

    const skipped = result.results.find((r) => r.bill_number === "HB 1");
    expect(skipped.summary_error).toBe("need_more_text");
    const saved = result.results.find((r) => r.bill_number === "HB 2");
    expect(saved.summary_error).toBeNull();
  });
});
