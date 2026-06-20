import request from "supertest";
import app from "../index";

// Set very low limits so tests don't need to fire hundreds of requests.
// Limits are read per-request (lazy), so setting them before the first call is enough.
beforeAll(() => {
  process.env.RATE_LIMIT_AUTH_MAX = "3";
  process.env.RATE_LIMIT_AUTH_WINDOW_MS = "60000";
  process.env.RATE_LIMIT_API_MAX = "5";
  process.env.RATE_LIMIT_API_WINDOW_MS = "60000";
});

afterAll(() => {
  delete process.env.RATE_LIMIT_AUTH_MAX;
  delete process.env.RATE_LIMIT_AUTH_WINDOW_MS;
  delete process.env.RATE_LIMIT_API_MAX;
  delete process.env.RATE_LIMIT_API_WINDOW_MS;
});

describe("Rate limiting", () => {
  describe("Auth limiter — POST /api/auth/login", () => {
    it("allows requests up to the limit", async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .send({ email: "x@x.com", password: "bad" });
        expect(res.status).not.toBe(429);
      }
    });

    it("returns 429 after limit exceeded", async () => {
      // Already used 3 above; one more should be rejected
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "x@x.com", password: "bad" });
      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/too many requests/i);
    });

    it("sets RateLimit-* headers", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "x@x.com", password: "bad" });
      expect(res.headers["ratelimit-limit"]).toBeDefined();
      expect(res.headers["ratelimit-remaining"]).toBeDefined();
    });
  });

  describe("Agent checkin skip", () => {
    it("is not blocked by the general API limiter", async () => {
      // Fire more than RATE_LIMIT_API_MAX requests at the checkin endpoint
      for (let i = 0; i < 8; i++) {
        const res = await request(app)
          .post("/api/agents/checkin")
          .set("X-Agent-Key", "wdg_fake.key")
          .send({ results: [] });
        // Will be 401 (bad key) but never 429
        expect(res.status).not.toBe(429);
      }
    });
  });
});
