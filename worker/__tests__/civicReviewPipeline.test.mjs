import { jest } from "@jest/globals";
import {
  evaluateStructuralCompleteness,
  reviewCivicItem,
} from "../src/lib/civicReviewPipeline.mjs";

jest.mock("../src/lib/billSummaryAnalyzer.mjs", () => ({
  ensureBillSummary: jest.fn().mockResolvedValue({ plain_summary: "ok" }),
}));

jest.mock("../src/lib/hotTopicsAnalyzer.mjs", () => ({
  analyzeBillForHotTopics: jest.fn().mockResolvedValue({ topics: [] }),
  saveHotTopicAnalysis: jest.fn().mockResolvedValue(undefined),
}));

class FakeStmt {
  constructor(handler) {
    this.handler = handler;
    this.bound = [];
  }
  bind(...args) {
    this.bound = args;
    return this;
  }
  async all() {
    return { results: await this.handler(this.bound) };
  }
  async run() {
    await this.handler(this.bound);
    return {};
  }
}

class FakeDB {
  constructor({ bills = [], sponsors = 0, records }) {
    this.bills = bills;
    this.sponsors = sponsors;
    this.records = records;
  }

  prepare(sql) {
    if (sql.includes("FROM civic_items")) {
      return new FakeStmt(([id]) => this.bills.filter((b) => b.id === id));
    }
    if (sql.includes("FROM bill_sponsors")) {
      return new FakeStmt(() => [{ sponsor_count: this.sponsors }]);
    }
    if (sql.includes("INSERT INTO civic_item_verification")) {
      return new FakeStmt((binds) => {
        this.records.push(binds);
        return [];
      });
    }
    if (sql.includes("SELECT id FROM civic_items")) {
      return new FakeStmt(() => this.bills.map((b) => ({ id: b.id })));
    }
    throw new Error(`Unhandled SQL in fake DB: ${sql}`);
  }
}

class FakePendingDB {
  constructor(rows) {
    this.rows = rows;
  }
  prepare(sql) {
    const includeOkOnly = sql.includes("civ.structural_ok = 1");
    const rows = includeOkOnly ? this.rows.filter((r) => r.structural_ok === 1) : this.rows;
    return new FakeStmt(() => rows);
  }
}

const baseBill = {
  id: "bill-1",
  bill_number: "HB0001",
  title: "Test Bill",
  summary: "Summary text",
  ai_summary: "AI summary",
  legislative_session: "2026",
  chamber: "house",
  source: "lso",
  jurisdiction_key: "WY",
  text_url: "http://example.com",
};

describe("evaluateStructuralCompleteness", () => {
  test("passes for valid WY bill with sponsor", () => {
    const result = evaluateStructuralCompleteness(baseBill, 1);
    expect(result.structural_ok).toBe(true);
  });

  test("flags missing sponsor", () => {
    const result = evaluateStructuralCompleteness(baseBill, 0);
    expect(result.structural_ok).toBe(false);
    expect(result.structural_reason).toBe("no_wyoming_sponsor");
  });

  test("flags wrong jurisdiction", () => {
    const result = evaluateStructuralCompleteness(
      { ...baseBill, jurisdiction_key: "UT" },
      1
    );
    expect(result.structural_ok).toBe(false);
    expect(result.structural_reason).toBe("wrong_jurisdiction");
  });
});

describe("reviewCivicItem", () => {
  test("marks valid bill as ok", async () => {
    const records = [];
    const env = {
      WY_DB: new FakeDB({ bills: [baseBill], sponsors: 1, records }),
    };
    const res = await reviewCivicItem(env, baseBill.id);
    expect(res.verification_status).toBe("ok");
    expect(res.structural_ok).toBe(true);
    expect(records.length).toBe(1);
  });

  test("flags bill with no sponsors", async () => {
    const records = [];
    const env = {
      WY_DB: new FakeDB({ bills: [baseBill], sponsors: 0, records }),
    };
    const res = await reviewCivicItem(env, baseBill.id);
    expect(res.verification_status).toBe("flagged");
    expect(res.structural_ok).toBe(false);
    expect(res.structural_reason).toBe("no_wyoming_sponsor");
    expect(records.length).toBe(1);
  });
});

describe("pending bills handler filters flagged by default", () => {
  test("exclude flagged unless include_flagged=true", async () => {
    const okRow = {
      id: "1",
      bill_number: "HB1",
      title: "Ok bill",
      chamber: "house",
      status: "introduced",
      legislative_session: "2026",
      subject_tags: null,
      ai_plain_summary: "Summary",
      ai_key_points_json: "[]",
      up_votes: 0,
      down_votes: 0,
      info_votes: 0,
      verification_status: "ok",
      status_reason: null,
      structural_ok: 1,
      structural_reason: null,
      has_wyoming_sponsor: 1,
      is_wyoming: 1,
      has_summary: 1,
      topic_slug: null,
      sponsor_name: null,
      text_url: "http://example.com",
      external_url: "http://example.com",
    };
    const flaggedRow = { ...okRow, id: "2", verification_status: "flagged", structural_ok: 0, structural_reason: "no_wyoming_sponsor" };

    const env = {
      WY_DB: new FakePendingDB([okRow, flaggedRow]),
      EVENTS_DB: { prepare: () => new FakeStmt(() => []) },
    };
    const { handlePendingBillsWithTopics } = await import(
      "../src/routes/pendingBills.mjs"
    );

    const req1 = new Request("http://example.test/api/civic/pending-bills-with-topics");
    const res1 = await handlePendingBillsWithTopics(req1, env);
    const data1 = await res1.json();
    expect(data1.results.length).toBe(1);

    const req2 = new Request("http://example.test/api/civic/pending-bills-with-topics?include_flagged=true");
    const res2 = await handlePendingBillsWithTopics(req2, env);
    const data2 = await res2.json();
    expect(data2.results.length).toBe(2);
  });
});
