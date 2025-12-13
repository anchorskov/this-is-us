// worker/__tests__/townhall-create-thread.test.mjs

import { jest } from "@jest/globals";

const mockRequireAuth = jest.fn();

jest.unstable_mockModule("../src/auth/verifyFirebaseOrAccess.mjs", () => ({
  requireAuth: mockRequireAuth,
}));

// Import handler after mocking
const { handleCreateTownhallThread } = await import(
  "../src/townhall/createThread.mjs"
);

function makeEnv(overrides = {}) {
  return {
    EVENTS_DB: {
      prepare: jest.fn(() => ({
        bind: jest.fn().mockReturnThis(),
        run: jest.fn().mockResolvedValue({}),
      })),
    },
    ...overrides,
  };
}

describe("handleCreateTownhallThread", () => {
  beforeEach(() => {
    mockRequireAuth.mockReset();
    mockRequireAuth.mockResolvedValue({ uid: "user-123" });
  });

  test("rejects missing auth", async () => {
    mockRequireAuth.mockRejectedValue(new Error("no auth"));
    const req = new Request("http://x/api/townhall/posts", {
      method: "POST",
      headers: {},
      body: JSON.stringify({ title: "Hi", prompt: "Body" }),
    });
    const resp = await handleCreateTownhallThread(req, makeEnv());
    expect(resp.status).toBe(401);
  });

  test("rejects missing required fields", async () => {
    const req = new Request("http://x/api/townhall/posts", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ title: "", prompt: "" }),
    });
    const resp = await handleCreateTownhallThread(req, makeEnv());
    expect(resp.status).toBe(400);
    const data = await resp.json();
    expect(data.error).toBe("Invalid request");
  });

  test("creates thread and returns 201", async () => {
    const req = new Request("http://x/api/townhall/posts", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ title: "Hello", prompt: "Body text" }),
    });
    const resp = await handleCreateTownhallThread(req, makeEnv());
    expect(resp.status).toBe(201);
    const data = await resp.json();
    expect(data.thread_id).toBeDefined();
    expect(data.created_at).toBeDefined();
  });

  test("handles DB error", async () => {
    const env = makeEnv({
      EVENTS_DB: {
        prepare: jest.fn(() => ({
          bind: jest.fn().mockReturnThis(),
          run: jest.fn().mockRejectedValue(new Error("db fail")),
        })),
      },
    });
    const req = new Request("http://x/api/townhall/posts", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ title: "Hello", prompt: "Body" }),
    });
    const resp = await handleCreateTownhallThread(req, env);
    expect(resp.status).toBe(500);
  });
});
