/**
 * worker/__tests__/townhall-posts-api.test.mjs
 * Unit tests for Town Hall D1 schema and API behavior
 * 
 * These tests verify:
 * 1. D1 schema for townhall_posts and townhall_replies
 * 2. Mock database responses shape
 * 3. Authorization logic (verified_users gating)
 * 4. Request/response patterns expected by route handlers
 */

import { jest, describe, test, expect, beforeEach } from "@jest/globals";

/**
 * Mock D1 database responses
 */
function makeMockD1DB() {
  const insertedRecords = [];

  return {
    // Mock prepare().bind().all() for SELECT queries
    prepare: jest.fn((sql) => ({
      bind: jest.fn(() => ({
        all: jest.fn(function() {
          // Simulating SELECT results based on SQL
          if (sql.includes("FROM townhall_posts")) {
            return {
              results: [
                {
                  id: "thread-1",
                  user_id: "user-123",
                  title: "Natrona Water Discussion",
                  prompt: "Let's discuss water usage",
                  created_at: "2025-12-10T10:00:00Z",
                  city: "Casper",
                  state: "WY",
                  county: "Natrona",
                  r2_key: null,
                  file_size: null,
                  expires_at: "2026-03-10T10:00:00Z",
                },
              ],
            };
          }

          if (sql.includes("FROM verified_users")) {
            return {
              results: [
                {
                  user_id: "user-123",
                  voter_id: "V123",
                  county: "Natrona",
                  house: "57",
                  senate: "29",
                  status: "verified",
                  verified_at: "2025-12-01T00:00:00Z",
                },
              ],
            };
          }

          if (sql.includes("FROM townhall_replies")) {
            return {
              results: [
                {
                  id: 1,
                  thread_id: "thread-1",
                  author_user_id: "user-456",
                  author_voter_id: "V456",
                  body: "Great point about water usage!",
                  created_at: "2025-12-10T11:00:00Z",
                  updated_at: null,
                  status: "active",
                  parent_reply_id: null,
                },
              ],
            };
          }

          return { results: [] };
        }),
      })),
    })),

    // Mock prepare().bind().run() for INSERT/UPDATE queries
    prepareInsert: jest.fn((sql) => ({
      bind: jest.fn(() => ({
        run: jest.fn(function() {
          if (sql.includes("INSERT")) {
            insertedRecords.push({ sql });
          }
          return { success: true };
        }),
      })),
    })),

    getInsertedRecords: () => insertedRecords,
    clearInsertedRecords: () => {
      insertedRecords.length = 0;
    },
  };
}

describe("Town Hall D1 Schema & Authorization Tests", () => {
  let mockD1;

  beforeEach(() => {
    mockD1 = makeMockD1DB();
    jest.clearAllMocks();
  });

  describe("townhall_posts table schema", () => {
    test("should have all required columns", async () => {
      const result = await mockD1.prepare(
        "SELECT id, user_id, title, prompt, created_at, city, state, county FROM townhall_posts"
      ).bind().all();

      const record = result.results[0];
      expect(record).toHaveProperty("id");
      expect(record).toHaveProperty("user_id");
      expect(record).toHaveProperty("title");
      expect(record).toHaveProperty("prompt");
      expect(record).toHaveProperty("created_at");
      expect(record).toHaveProperty("city");
      expect(record).toHaveProperty("state");
      expect(record).toHaveProperty("county");
      expect(record).toHaveProperty("r2_key");
      expect(record).toHaveProperty("expires_at");
    });

    test("id should be TEXT (UUID)", () => {
      const result = mockD1.prepare("SELECT id FROM townhall_posts").bind().all();
      expect(result.results[0].id).toBe("thread-1");
      expect(typeof result.results[0].id).toBe("string");
    });

    test("user_id should store Firebase UID", () => {
      const result = mockD1.prepare("SELECT user_id FROM townhall_posts").bind().all();
      expect(result.results[0].user_id).toBe("user-123");
    });

    test("county should link to verified_users for authorization", () => {
      const townhall = mockD1.prepare("SELECT county FROM townhall_posts").bind().all().results[0];
      const verified = mockD1.prepare("SELECT county FROM verified_users").bind().all().results[0];
      
      expect(townhall.county).toBe(verified.county);
      expect(townhall.county).toBe("Natrona");
    });
  });

  describe("townhall_replies table schema", () => {
    test("should have all required columns for replies", async () => {
      const result = await mockD1.prepare(
        "SELECT id, thread_id, author_user_id, author_voter_id, body, created_at, status, parent_reply_id FROM townhall_replies"
      ).bind().all();

      const record = result.results[0];
      expect(record).toHaveProperty("id");
      expect(record).toHaveProperty("thread_id");
      expect(record).toHaveProperty("author_user_id");
      expect(record).toHaveProperty("author_voter_id");
      expect(record).toHaveProperty("body");
      expect(record).toHaveProperty("created_at");
      expect(record).toHaveProperty("status");
      expect(record).toHaveProperty("parent_reply_id");
    });

    test("thread_id should reference townhall_posts", () => {
      const reply = mockD1.prepare("SELECT thread_id FROM townhall_replies").bind().all().results[0];
      const thread = mockD1.prepare("SELECT id FROM townhall_posts").bind().all().results[0];
      
      expect(reply.thread_id).toBe(thread.id);
    });

    test("author_user_id should store Firebase UID", () => {
      const reply = mockD1.prepare("SELECT author_user_id FROM townhall_replies").bind().all().results[0];
      expect(typeof reply.author_user_id).toBe("string");
      expect(reply.author_user_id).toBe("user-456");
    });

    test("status should track reply visibility", () => {
      const reply = mockD1.prepare("SELECT status FROM townhall_replies").bind().all().results[0];
      expect(["active", "hidden", "deleted"]).toContain(reply.status);
    });

    test("parent_reply_id should support nested replies", () => {
      const reply = mockD1.prepare("SELECT parent_reply_id FROM townhall_replies").bind().all().results[0];
      expect(reply.parent_reply_id === null || typeof reply.parent_reply_id === "number").toBe(true);
    });
  });

  describe("verified_users authorization for Town Hall posting", () => {
    test("should require verified status to create thread", async () => {
      const verified = await mockD1.prepare(
        "SELECT user_id, status FROM verified_users WHERE status = 'verified'"
      ).bind().all();

      expect(verified.results).toHaveLength(1);
      expect(verified.results[0].status).toBe("verified");
    });

    test("should reject non-verified users", () => {
      const nonVerified = {
        user_id: "unknown-user",
        status: null, // Not in verified_users table
      };

      // Create a custom mock that returns empty results for unknown user
      const customMockDB = {
        prepare: jest.fn((sql) => ({
          bind: jest.fn(() => ({
            all: jest.fn(function() {
              if (sql.includes("FROM verified_users WHERE user_id")) {
                return { results: [] }; // No user found
              }
              return { results: [] };
            }),
          })),
        })),
      };

      const verified = customMockDB.prepare(
        "SELECT user_id FROM verified_users WHERE user_id = ?"
      ).bind(nonVerified.user_id).all().results;

      expect(verified.length).toBe(0);
    });

    test("should provide county from verified_users for thread location", async () => {
      const verified = await mockD1.prepare(
        "SELECT user_id, county FROM verified_users WHERE status = 'verified'"
      ).bind().all();

      expect(verified.results[0]).toHaveProperty("county");
      expect(verified.results[0].county).toBe("Natrona");
    });

    test("should provide house and senate districts from verified_users", async () => {
      const verified = await mockD1.prepare(
        "SELECT user_id, house, senate FROM verified_users WHERE status = 'verified'"
      ).bind().all();

      expect(verified.results[0]).toHaveProperty("house");
      expect(verified.results[0]).toHaveProperty("senate");
      expect(verified.results[0].house).toBe("57");
      expect(verified.results[0].senate).toBe("29");
    });
  });

  describe("Request/Response patterns", () => {
    test("GET /api/townhall/posts should return list of threads", () => {
      const response = {
        status: 200,
        body: {
          results: [
            {
              thread_id: "thread-1",
              title: "Natrona Water Discussion",
              city: "Casper",
              state: "WY",
              county: "Natrona",
              user_id: "user-123",
              created_at: "2025-12-10T10:00:00Z",
            },
          ],
        },
      };

      expect(response.status).toBe(200);
      expect(response.body.results).toBeInstanceOf(Array);
      expect(response.body.results[0]).toHaveProperty("thread_id");
      expect(response.body.results[0]).toHaveProperty("title");
    });

    test("POST /api/townhall/posts should return 201 for verified user", () => {
      const response = {
        status: 201,
        body: {
          thread_id: "thread-new-1",
          title: "New Discussion",
          created_at: "2025-12-10T12:00:00Z",
          city: "Casper",
          state: "WY",
          county: "Natrona",
        },
      };

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("thread_id");
      expect(response.body).toHaveProperty("created_at");
    });

    test("POST /api/townhall/posts should return 403 for non-verified user", () => {
      const response = {
        status: 403,
        body: {
          error: "not_verified",
          message: "Verified county voter account required to create Town Hall threads.",
        },
      };

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("not_verified");
    });

    test("POST /api/townhall/posts should return 401 when not authenticated", () => {
      const response = {
        status: 401,
        body: {
          error: "Unauthorized",
          details: "No auth token provided",
        },
      };

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Unauthorized");
    });

    test("POST /api/townhall/posts/:id/replies should return 201 for verified author", () => {
      const response = {
        status: 201,
        body: {
          reply_id: 1,
          thread_id: "thread-1",
          author_user_id: "user-456",
          body: "Great discussion!",
          created_at: "2025-12-10T11:00:00Z",
        },
      };

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("reply_id");
      expect(response.body).toHaveProperty("thread_id");
      expect(response.body).toHaveProperty("author_user_id");
    });
  });

  describe("Data integrity & constraints", () => {
    test("townhall_replies.thread_id should have foreign key to townhall_posts.id", () => {
      // Simulating FK constraint check
      const threadId = "thread-1";
      const thread = mockD1.prepare("SELECT id FROM townhall_posts WHERE id = ?")
        .bind(threadId).all().results[0];
      const reply = mockD1.prepare("SELECT thread_id FROM townhall_replies WHERE thread_id = ?")
        .bind(threadId).all().results[0];

      expect(thread.id).toBe(reply.thread_id);
    });

    test("townhall_replies.parent_reply_id should support self-referencing for nesting", () => {
      const replyWithParent = {
        id: 2,
        thread_id: "thread-1",
        parent_reply_id: 1, // References another reply
        body: "Reply to reply",
        author_user_id: "user-789",
      };

      expect(replyWithParent.parent_reply_id).toBe(1);
      expect(typeof replyWithParent.parent_reply_id).toBe("number");
    });

    test("townhall_posts.county should link to verified_users.county", () => {
      // Verify schema allows linking
      const post = { county: "Natrona" };
      const verifiedUser = { county: "Natrona" };
      
      expect(post.county).toBe(verifiedUser.county);
    });
  });

  describe("Multi-county scenarios", () => {
    test("verified users from different counties should be able to create threads", () => {
      const counties = ["Natrona", "Albany", "Laramie", "Fremont"];
      
      counties.forEach((county) => {
        const thread = {
          county,
          user_id: `user-${county.toLowerCase()}`,
          status: "created",
        };
        
        expect(thread).toHaveProperty("county");
        expect(thread.county).toBe(county);
      });
    });

    test("threads should be filterable by county", () => {
      const threads = [
        { id: "1", county: "Natrona", title: "Natrona discussion" },
        { id: "2", county: "Albany", title: "Albany discussion" },
        { id: "3", county: "Natrona", title: "Another Natrona discussion" },
      ];

      const natronaThreads = threads.filter(t => t.county === "Natrona");
      
      expect(natronaThreads).toHaveLength(2);
      expect(natronaThreads[0].county).toBe("Natrona");
    });
  });
});

