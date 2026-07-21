import request from "supertest";
import app from "../index";

// Use very low limits so tests don't need to fire hundreds of requests.
// Limits are read per-request (lazy fn), so setting them before the first call works.
beforeAll(() => {
  process.env.RATE_LIMIT_AUTH_MAX = "20";
  process.env.RATE_LIMIT_AUTH_WINDOW_MS = "60000";
  process.env.RATE_LIMIT_API_MAX = "200";
  process.env.RATE_LIMIT_API_WINDOW_MS = "60000";
  // Endpoint-specific overrides used in the tests below
  process.env.RATE_LIMIT_LOGIN_MAX = "3";
  process.env.RATE_LIMIT_REGISTER_MAX = "2";
  process.env.RATE_LIMIT_TEST_WEBHOOK_MAX = "2";
  process.env.RATE_LIMIT_CHECKIN_MAX = "3";
});

afterAll(() => {
  delete process.env.RATE_LIMIT_AUTH_MAX;
  delete process.env.RATE_LIMIT_AUTH_WINDOW_MS;
  delete process.env.RATE_LIMIT_API_MAX;
  delete process.env.RATE_LIMIT_API_WINDOW_MS;
  delete process.env.RATE_LIMIT_LOGIN_MAX;
  delete process.env.RATE_LIMIT_REGISTER_MAX;
  delete process.env.RATE_LIMIT_TEST_WEBHOOK_MAX;
  delete process.env.RATE_LIMIT_CHECKIN_MAX;
});

// Isolated IP ranges used only within this test suite so the rate-limit
// MemoryStore counters don't bleed into other test files that share the process.
const LOGIN_TEST_IP = "10.99.1.1";
const REGISTER_TEST_IP = "10.99.1.2";
const CHECKIN_TEST_IP = "10.99.1.3";
const API_TEST_IP = "10.99.1.4";

describe("Rate limiting", () => {
  // ---------------------------------------------------------------------------
  // Login — 3/min per IP (lowered via env for the test suite)
  // ---------------------------------------------------------------------------
  describe("POST /api/auth/login", () => {
    it("allows requests up to the limit", async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", LOGIN_TEST_IP)
          .send({ email: "x@x.com", password: "bad" });
        // 401 is expected (wrong creds), never 429
        expect(res.status).not.toBe(429);
      }
    });

    it("returns 429 after limit exceeded", async () => {
      // Already used 3 above — this (4th) should be rejected
      const res = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", LOGIN_TEST_IP)
        .send({ email: "x@x.com", password: "bad" });
      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/too many/i);
    });

    it("sets RateLimit-* standard headers", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", LOGIN_TEST_IP)
        .send({ email: "x@x.com", password: "bad" });
      expect(res.headers["ratelimit-limit"]).toBeDefined();
      expect(res.headers["ratelimit-remaining"]).toBeDefined();
      expect(res.headers["ratelimit-reset"]).toBeDefined();
    });

    it("sets Retry-After header when blocked", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", LOGIN_TEST_IP)
        .send({ email: "x@x.com", password: "bad" });
      expect(res.status).toBe(429);
      // express-rate-limit sets retry-after (seconds until window resets)
      expect(res.headers["retry-after"]).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Register — 2/min per IP (lowered via env)
  // ---------------------------------------------------------------------------
  describe("POST /api/auth/register", () => {
    it("allows requests up to the limit", async () => {
      for (let i = 0; i < 2; i++) {
        const res = await request(app)
          .post("/api/auth/register")
          .set("X-Forwarded-For", REGISTER_TEST_IP)
          .send({ email: `new${i}@x.com`, password: "Password1!", name: "Test" });
        expect(res.status).not.toBe(429);
      }
    });

    it("returns 429 after limit exceeded", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .set("X-Forwarded-For", REGISTER_TEST_IP)
        .send({ email: "another@x.com", password: "Password1!", name: "Test" });
      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Agent checkin — 3/min per agent key (lowered via env)
  // ---------------------------------------------------------------------------
  describe("POST /api/agents/checkin", () => {
    const fakeKey = "wdg_fake.key";

    it("allows requests up to the limit", async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post("/api/agents/checkin")
          .set("X-Forwarded-For", CHECKIN_TEST_IP)
          .set("X-Agent-Key", fakeKey)
          .send({ results: [] });
        // 401 (bad key) is expected — never 429
        expect(res.status).not.toBe(429);
      }
    });

    it("returns 429 after checkin limit exceeded", async () => {
      const res = await request(app)
        .post("/api/agents/checkin")
        .set("X-Forwarded-For", CHECKIN_TEST_IP)
        .set("X-Agent-Key", fakeKey)
        .send({ results: [] });
      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
    });

    it("uses agent key as the rate-limit bucket (different keys are independent)", async () => {
      const otherKey = "wdg_other.key";
      const res = await request(app)
        .post("/api/agents/checkin")
        .set("X-Forwarded-For", CHECKIN_TEST_IP)
        .set("X-Agent-Key", otherKey)
        .send({ results: [] });
      // Different key — not yet over the limit, so should get 401 not 429
      expect(res.status).not.toBe(429);
    });

    it("is not counted against the general API limiter", async () => {
      // Fire more than RATE_LIMIT_CHECKIN_MAX with a fresh key — if the general API
      // limiter fired instead we'd get a different error message
      const freshKey = "wdg_fresh.key";
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post("/api/agents/checkin")
          .set("X-Forwarded-For", CHECKIN_TEST_IP)
          .set("X-Agent-Key", freshKey)
          .send({ results: [] });
        if (res.status === 429) {
          expect(res.body.error).toMatch(/agent check-in/i);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // RateLimit-* headers — present on non-blocked responses too
  // ---------------------------------------------------------------------------
  describe("RateLimit headers", () => {
    it("API limiter sets standard RateLimit-* headers", async () => {
      const res = await request(app)
        .get("/api/monitors")
        .set("X-Forwarded-For", API_TEST_IP)
        .set("Authorization", "Bearer invalid");
      expect(res.headers["ratelimit-limit"]).toBeDefined();
      expect(res.headers["ratelimit-remaining"]).toBeDefined();
    });
  });
});
