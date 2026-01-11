/**
 * __tests__/wyoleg-topics-db.test.js
 * Coverage for WY_DB routing and hot topic safeguards.
 */

import { getCivicDb, getEventsDb } from "../worker/src/lib/dbHelpers.mjs";
import { dedupeTopics } from "../worker/src/routes/api/user-topics/index.js";
import { saveBillSummary, ensureHotTopicForBill } from "../worker/src/lib/billSummaryAnalyzer.mjs";

function makeDb({ tables = [], columns = {} } = {}) {
  return {
    prepare(sql) {
      if (sql.includes("sqlite_master")) {
        let bound = [];
        return {
          bind(...args) {
            bound = args;
            return this;
          },
          async first() {
            const name = bound[0];
            return tables.includes(name) ? { name } : null;
          },
        };
      }
      if (sql.startsWith("PRAGMA table_info")) {
        const table = sql.match(/PRAGMA table_info\(([^)]+)\)/)?.[1] || "";
        const cols = columns[table] || [];
        return {
          async all() {
            return { results: cols.map((name) => ({ name })) };
          },
        };
      }
      return {
        bind() {
          return this;
        },
        async first() {
          return null;
        },
        async run() {
          return {};
        },
      };
    },
  };
}

describe("DB selection helpers", () => {
  test("getCivicDb returns WY_DB over EVENTS_DB", () => {
    const wy = { name: "wy" };
    const events = { name: "events" };
    const env = { WY_DB: wy, EVENTS_DB: events };
    expect(getCivicDb(env)).toBe(wy);
  });

  test("getEventsDb returns EVENTS_DB when present", () => {
    const events = { name: "events" };
    const env = { EVENTS_DB: events };
    expect(getEventsDb(env)).toBe(events);
  });
});

describe("Summary persistence", () => {
  test("saveBillSummary does not persist empty summaries", async () => {
    const prepared = [];
    const env = {
      WY_DB: {
        prepare(sql) {
          prepared.push(sql);
          return {
            bind() {
              return this;
            },
            async run() {
              return {};
            },
          };
        },
      },
    };

    await saveBillSummary(env, "bill-1", {
      plain_summary: "",
      key_points: [],
      note: "empty_summary",
      source: "test",
      is_authoritative: false,
    });

    const summarySql = prepared.find((sql) => sql.includes("ai_summary"));
    expect(summarySql).toBeUndefined();
  });
});

describe("Hot topic safeguards", () => {
  test("ensureHotTopicForBill skips on blank DB without crashing", async () => {
    const env = { WY_DB: makeDb() };
    const result = await ensureHotTopicForBill(env, null, {
      id: "bill-1",
      bill_number: "HB 1",
      ai_summary: "This summary is long enough to pass the length gate.",
      summary_error: "ok",
    });
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("hot_topics_schema_missing");
  });

  test("ensureHotTopicForBill requires confidence column", async () => {
    const env = {
      WY_DB: makeDb({
        tables: ["hot_topics", "hot_topic_civic_items"],
        columns: { hot_topic_civic_items: ["topic_id", "civic_item_id"] },
      }),
    };
    const result = await ensureHotTopicForBill(env, null, {
      id: "bill-2",
      bill_number: "HB 2",
      ai_summary: "This summary is long enough to pass the length gate.",
      summary_error: "ok",
    });
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("missing_confidence_column");
  });
});

describe("User topics API de-duplication", () => {
  test("dedupeTopics removes duplicate slugs", () => {
    const rows = [
      { id: 1, slug: "tax", name: "Tax", checked: 0 },
      { id: 2, slug: "tax", name: "Tax Duplicate", checked: 1 },
      { id: 3, slug: "water", name: "Water", checked: 0 },
    ];
    const deduped = dedupeTopics(rows);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((r) => r.slug)).toEqual(["tax", "water"]);
  });
});
