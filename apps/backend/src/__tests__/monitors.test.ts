import request from "supertest";
import app from "../index";
import { prisma } from "../db";

const TEST_EMAIL = "test-monitors@watchdog.test";
let token: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  const res = await request(app).post("/api/auth/register").send({
    email: TEST_EMAIL,
    password: "password123",
    name: "Test User",
  });
  token = res.body.token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

describe("GET /api/monitors", () => {
  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/monitors");
    expect(res.status).toBe(401);
  });

  it("returns empty list for new user", async () => {
    const res = await request(app)
      .get("/api/monitors")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe("POST /api/monitors", () => {
  it("creates a monitor", async () => {
    const res = await request(app)
      .post("/api/monitors")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Example", url: "https://example.com" });
    expect(res.status).toBe(201);
    expect(res.body.data.url).toBe("https://example.com");
  });

  it("rejects invalid url", async () => {
    const res = await request(app)
      .post("/api/monitors")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bad", url: "not-a-url" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/monitors - synthetic type", () => {
  const validSteps = [
    { action: "navigate", url: "https://example.com/login" },
    { action: "fill", selector: "#username", value: "demo@example.com" },
    { action: "click", selector: "#login-button" },
    { action: "assert_text", selector: "h1", text: "Dashboard" },
  ];

  const originalFlag = process.env.SYNTHETIC_MONITORING_ENABLED;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.SYNTHETIC_MONITORING_ENABLED;
    else process.env.SYNTHETIC_MONITORING_ENABLED = originalFlag;
  });

  it("rejects synthetic monitors when the feature flag is disabled", async () => {
    delete process.env.SYNTHETIC_MONITORING_ENABLED;

    const res = await request(app)
      .post("/api/monitors")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Login flow", url: "https://example.com", intervalMinutes: 5, type: "synthetic", syntheticSteps: validSteps });

    expect(res.status).toBe(400);
  });

  it("creates a synthetic monitor when the feature flag is enabled and steps are valid", async () => {
    process.env.SYNTHETIC_MONITORING_ENABLED = "true";

    const res = await request(app)
      .post("/api/monitors")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Login flow", url: "https://example.com", intervalMinutes: 5, type: "synthetic", syntheticSteps: validSteps });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe("synthetic");
    expect(res.body.data.syntheticSteps).toEqual(validSteps);
  });

  it("rejects empty steps", async () => {
    process.env.SYNTHETIC_MONITORING_ENABLED = "true";

    const res = await request(app)
      .post("/api/monitors")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Login flow", url: "https://example.com", intervalMinutes: 5, type: "synthetic", syntheticSteps: [] });

    expect(res.status).toBe(400);
  });

  it("rejects steps whose first action isn't 'navigate'", async () => {
    process.env.SYNTHETIC_MONITORING_ENABLED = "true";

    const res = await request(app)
      .post("/api/monitors")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Login flow",
        url: "https://example.com",
        intervalMinutes: 5,
        type: "synthetic",
        syntheticSteps: [{ action: "click", selector: "#submit" }],
      });

    expect(res.status).toBe(400);
  });

  it("rejects an interval below 5 minutes for synthetic monitors", async () => {
    process.env.SYNTHETIC_MONITORING_ENABLED = "true";

    const res = await request(app)
      .post("/api/monitors")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Login flow", url: "https://example.com", intervalMinutes: 1, type: "synthetic", syntheticSteps: validSteps });

    expect(res.status).toBe(400);
  });
});
