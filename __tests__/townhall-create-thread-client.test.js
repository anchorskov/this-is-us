/**
 * __tests__/townhall-create-thread-client.test.js
 */

import { jest } from "@jest/globals";
import { submitThread } from "../static/js/townhall/create-thread.js";

describe("submitThread", () => {
  const origFetch = global.fetch;
  afterEach(() => {
    global.fetch = origFetch;
  });

  test("posts to /api/townhall/posts with auth", async () => {
    const mockToken = "abc";
    const user = { getIdToken: jest.fn().mockResolvedValue(mockToken) };
    const payload = { title: "Hi", prompt: "Body" };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ thread_id: "t1" }),
    });

    const res = await submitThread(user, payload);
    expect(res.thread_id).toBe("t1");
    expect(global.fetch).toHaveBeenCalledWith("/api/townhall/posts", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: `Bearer ${mockToken}`,
      }),
    }));
  });

  test("throws on failure", async () => {
    const user = { getIdToken: jest.fn().mockResolvedValue("abc") };
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("fail"),
    });
    await expect(submitThread(user, { title: "x", prompt: "y" })).rejects.toThrow();
  });
});
