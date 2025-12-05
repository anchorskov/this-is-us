import { requireAuth } from "../src/auth/verifyFirebaseOrAccess.mjs";

/* Enable dev bypass so we don't call external JWKS during tests */
global.__DEV_WORKER__ = true;

const mkReq = (headers = {}, cookies = "") => ({
  headers: {
    get: (k) => headers[k] || null,
  },
  url: "https://example.com/api/townhall/create",
});

describe("verifyFirebaseOrAccess (requireAuth)", () => {
  test("rejects when no auth is provided", async () => {
    await expect(requireAuth(mkReq(), {})).rejects.toHaveProperty("status", 401);
  });

  test("accepts Bearer token in dev bypass", async () => {
    const req = mkReq({ Authorization: "Bearer demo-token" });
    const id = await requireAuth(req, { FIREBASE_PROJECT_ID: "demo" });
    expect(id.uid).toMatch(/^dev-/);
    expect(id.source).toBe("firebase");
  });

  test("accepts Cloudflare Access headers", async () => {
    const req = mkReq({
      "CF-Access-Authenticated-User-Email": "user@example.com",
      "CF-Access-Authenticated-User-Id": "abc123",
    });
    const id = await requireAuth(req, { FIREBASE_PROJECT_ID: "demo" });
    expect(id.source).toBe("access");
    expect(id.uid).toBe("abc123");
    expect(id.email).toBe("user@example.com");
  });

  test("accepts __session cookie when present", async () => {
    const req = {
      headers: {
        get: (k) =>
          k === "Cookie" ? "__session=cookie-token" : null,
      },
      url: "https://example.com/api/townhall/create",
    };
    const id = await requireAuth(req, { FIREBASE_PROJECT_ID: "demo" });
    expect(id.uid).toMatch(/^dev-/);
    expect(id.source).toBe("firebase");
  });

  test("prefers Cloudflare Access over Firebase when both exist", async () => {
    const req = mkReq({
      Authorization: "Bearer demo-token",
      "CF-Access-Authenticated-User-Email": "access@example.com",
      "CF-Access-Authenticated-User-Id": "access-uid",
    });
    const id = await requireAuth(req, { FIREBASE_PROJECT_ID: "demo" });
    expect(id.source).toBe("access");
    expect(id.uid).toBe("access-uid");
  });
});
