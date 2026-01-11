import {
  ensureHotTopicForBill,
  generateHotTopicCandidates,
  isValidTopicLabel,
} from "../src/lib/billSummaryAnalyzer.mjs";

function createMockDb() {
  const topics = new Map();
  const billTopics = new Map(); // key: `${bill_id}|${topic_key}`

  return {
    topics,
    billTopics,
    prepare(sql) {
      const statement = {
        sql,
        params: [],
        bind(...params) {
          this.params = params;
          return this;
        },
        async first() {
          if (sql.includes("sqlite_master")) {
            const table = this.params?.[0];
            if (table === "topics" || table === "bill_topics") {
              return { name: table };
            }
            return null;
          }
          if (sql.startsWith("SELECT COUNT(*) as count FROM bill_topics")) {
            const billId = this.params[0];
            const count = Array.from(billTopics.keys()).filter((k) =>
              k.startsWith(`${billId}|`)
            ).length;
            return { count };
          }
          return null;
        },
        async run() {
          if (sql.startsWith("INSERT INTO topics")) {
            const [topic_key, label_short, label_full, one_sentence, , parent_key, status] =
              this.params;
            topics.set(topic_key, {
              topic_key,
              label_short,
              label_full,
              one_sentence,
              parent_key,
              status,
            });
            return { success: true };
          }

          if (sql.startsWith("INSERT INTO bill_topics")) {
            const [bill_id, topic_key, confidence] = this.params;
            billTopics.set(`${bill_id}|${topic_key}`, {
              bill_id,
              topic_key,
              confidence,
            });
            return { success: true };
          }

          return { success: true };
        },
      };

      return statement;
    },
  };
}

describe("topic object pipeline", () => {
  const summaryText =
    "This bill expands property tax relief for homeowners, adjusts assessments, and funds county-level support programs to reduce burdens.";

  test("creates topics and links bill", async () => {
    const mockDb = createMockDb();
    const env = {
      OPENAI_API_KEY: "test",
      TEST_TOPICS_RESPONSE: JSON.stringify({
        topics: [
          {
            topic_key: "property-tax-relief",
            label_short: "Property Tax Relief",
            label_full: "Property Tax Relief",
            one_sentence: "Relief for property taxpayers.",
            confidence: 0.9,
          },
          {
            topic_key: "county-support-programs",
            label_short: "County Support Programs",
            label_full: "County Support Programs",
            one_sentence: "Funds for counties.",
            confidence: 0.6,
          },
        ],
      }),
    };

    const civicItem = {
      id: "bill-1",
      ai_summary: summaryText,
      summary_error: "ok",
    };

    const result = await ensureHotTopicForBill(env, mockDb, civicItem);

    expect(result.status).toBe("created");
    expect(result.topic_count).toBeGreaterThanOrEqual(2);
    expect(mockDb.topics.size).toBeGreaterThanOrEqual(2);
    expect(mockDb.billTopics.size).toBeGreaterThanOrEqual(2);
  });

  test("idempotent when bill already linked", async () => {
    const mockDb = createMockDb();
    const env = {
      OPENAI_API_KEY: "test",
      TEST_TOPICS_RESPONSE: JSON.stringify({
        topics: [
          {
            topic_key: "property-tax-relief",
            label_short: "Property Tax Relief",
            label_full: "Property Tax Relief",
            one_sentence: "Relief for property taxpayers.",
            confidence: 0.9,
          },
        ],
      }),
    };
    const civicItem = { id: "bill-1", ai_summary: summaryText, summary_error: "ok" };

    const first = await ensureHotTopicForBill(env, mockDb, civicItem);
    expect(first.status).toBe("created");

    const second = await ensureHotTopicForBill(env, mockDb, civicItem);
    expect(second.status).toBe("existing");
    expect(second.topic_count).toBe(1);
    expect(mockDb.billTopics.size).toBe(1);
  });

  test("falls back to heuristic and uses WY_DB binding", async () => {
    const mockDb = createMockDb();
    const env = {
      WY_DB: mockDb,
      TEST_TOPICS_RESPONSE: JSON.stringify({ topics: [] }), // invalid/empty
    };
    const civicItem = { id: "bill-2", ai_summary: summaryText, summary_error: "ok" };

    const result = await ensureHotTopicForBill(env, null, civicItem);

    expect(result.status).toBe("created");
    expect(result.topic_count).toBeGreaterThan(0);
    expect(
      Array.from(mockDb.billTopics.values()).every(
        (r) => r.topic_key && r.topic_key.length > 0
      )
    ).toBe(true);
  });

  test("heuristic candidate generation yields Title Case labels", () => {
    const candidates = generateHotTopicCandidates(summaryText);
    expect(candidates.length).toBeGreaterThan(0);
    expect(isValidTopicLabel(candidates[0])).toBe(true);
  });
});
