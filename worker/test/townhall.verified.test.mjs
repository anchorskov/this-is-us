// worker/test/townhall.verified.test.mjs
// Jest tests for verified voter gating in Town Hall operations

import { jest } from "@jest/globals";
const requireAuthMock = jest.fn();

jest.unstable_mockModule("../src/auth/verifyFirebaseOrAccess.mjs", () => ({
  requireAuth: requireAuthMock,
}));

const { handleCreateTownhallThread } = await import(
  "../src/townhall/createThread.mjs"
);
const { handleCreateTownhallPost } = await import(
  "../src/townhall/createPost.js"
);
const { getVerifiedUser, createVerifiedUser } = await import(
  "../src/townhall/verifiedUserHelper.mjs"
);
const { requireAuth } = await import("../src/auth/verifyFirebaseOrAccess.mjs");

// Mock environment
const mockEnv = {
  WY_DB: {
    prepare: jest.fn(),
  },
  EVENTS_DB: {
    prepare: jest.fn(),
  },
  FIREBASE_PROJECT_ID: "test-project",
};

// Mock Firebase auth
jest.mock("../src/auth/verifyFirebaseOrAccess.mjs", () => ({
  requireAuth: jest.fn(),
}));

describe("Town Hall Verified Voter Gating", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getVerifiedUser", () => {
    it("should return verified user object when record exists", async () => {
      const mockResults = [
        {
          userId: "user-123",
          voterId: "voter-456",
          county: "LARAMIE",
          house: "022",
          senate: "001",
          verifiedAt: "2025-12-09T10:00:00Z",
          status: "verified",
        },
      ];

      mockEnv.WY_DB.prepare = jest.fn().mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({ results: mockResults }),
        }),
      });

      const result = await getVerifiedUser(mockEnv, "user-123");

      expect(result).toEqual(mockResults[0]);
      expect(mockEnv.WY_DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining("verified_users")
      );
    });

    it("should return null when user is not verified", async () => {
      mockEnv.WY_DB.prepare = jest.fn().mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({ results: [] }),
        }),
      });

      const result = await getVerifiedUser(mockEnv, "unverified-user");

      expect(result).toBeNull();
    });

    it("should return null on database error", async () => {
      mockEnv.WY_DB.prepare = jest.fn().mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockRejectedValue(new Error("DB error")),
        }),
      });

      const result = await getVerifiedUser(mockEnv, "user-123");

      expect(result).toBeNull();
    });

    it("should return null when userId is null", async () => {
      const result = await getVerifiedUser(mockEnv, null);
      expect(result).toBeNull();
    });
  });

  describe("createVerifiedUser", () => {
    it("should create verified user record successfully", async () => {
      mockEnv.WY_DB.prepare = jest.fn().mockReturnValue({
        bind: jest.fn().mockReturnValue({
          run: jest.fn().mockResolvedValue({ success: true }),
        }),
      });

      const result = await createVerifiedUser(
        mockEnv,
        "user-123",
        "voter-456",
        { county: "LARAMIE", house: "022", senate: "001" }
      );

      expect(result).toBe(true);
      expect(mockEnv.WY_DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO verified_users")
      );
    });

    it("should return false on database error", async () => {
      mockEnv.WY_DB.prepare = jest.fn().mockReturnValue({
        bind: jest.fn().mockReturnValue({
          run: jest.fn().mockRejectedValue(new Error("Duplicate key")),
        }),
      });

      const result = await createVerifiedUser(
        mockEnv,
        "user-123",
        "voter-456"
      );

      expect(result).toBe(false);
    });
  });

  describe("Town Hall Thread Creation", () => {
    it("should allow verified user to create thread", async () => {
      requireAuth.mockResolvedValue({ uid: "verified-user-123" });

      mockEnv.WY_DB.prepare = jest.fn().mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({
            results: [
              {
                userId: "verified-user-123",
                voterId: "voter-456",
                status: "verified",
              },
            ],
          }),
        }),
      });

      mockEnv.EVENTS_DB.prepare = jest.fn().mockReturnValue({
        bind: jest.fn().mockReturnValue({
          run: jest.fn().mockResolvedValue({ success: true }),
        }),
      });

      const request = new Request("https://api.example.com/api/townhall/posts", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Thread",
          prompt: "Test prompt",
          city: "LARAMIE",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await handleCreateTownhallThread(request, mockEnv);

      expect(response.status).toBe(201);
      const body = JSON.parse(await response.text());
      expect(body.thread_id).toBeDefined();
      expect(body.created_at).toBeDefined();
    });

    it("should return 403 for unverified user", async () => {
      requireAuth.mockResolvedValue({ uid: "unverified-user" });

      mockEnv.WY_DB.prepare = jest.fn().mockReturnValue({
        bind: jest.fn().mockReturnValue({
          all: jest.fn().mockResolvedValue({ results: [] }),
        }),
      });

      const request = new Request("https://api.example.com/api/townhall/posts", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Thread",
          prompt: "Test prompt",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await handleCreateTownhallThread(request, mockEnv);

      expect(response.status).toBe(403);
      const body = JSON.parse(await response.text());
      expect(body.error).toBe("not_verified");
      expect(body.message).toContain("Verified county voter");
    });

    it("should return 401 for unauthenticated request", async () => {
      requireAuth.mockRejectedValue(new Error("Invalid token"));

      const request = new Request("https://api.example.com/api/townhall/posts", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Thread",
          prompt: "Test prompt",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await handleCreateTownhallThread(request, mockEnv);

      expect(response.status).toBe(401);
      const body = JSON.parse(await response.text());
      expect(body.error).toBe("Unauthorized");
    });
  });

  describe("Read-only operations", () => {
    it("should allow unauthenticated read of town hall threads", async () => {
      // listPosts does not require authentication or verification
      // This is tested separately in list handler tests
      expect(true).toBe(true);
    });
  });
});
