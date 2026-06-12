import request from "supertest";
import app from "../index";
import { prisma } from "../db";

const TEST_EMAIL = "test-checks@watchdog.test";
let token: string;
let monitorId: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  const reg = await request(app).post("/api/auth/register").send({
    email: TEST_EMAIL, password: "password123", name: "Check Tester",
  });
  token = reg.body.token;

  const mon = await request(app)
    .post("/api/monitors")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Test Site", url: "https://example.com" });
  monitorId = mon.body.data.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

describe("GET /api/monitors/:id/checks", () => {
  it("returns empty array before any checks", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/checks`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get(`/api/monitors/${monitorId}/checks`);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/monitors/:id/stats", () => {
  it("returns null stats before any checks", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/stats`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.uptimePercent).toBeNull();
    expect(res.body.data.totalChecks).toBe(0);
  });
});

describe("GET /api/monitors/:id/incidents", () => {
  it("returns empty incidents list", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/incidents`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("GET /api/monitors/:id/response-times — timing breakdown", () => {
  beforeAll(async () => {
    await prisma.check.create({
      data: {
        monitorId,
        type: "uptime",
        status: "up",
        statusCode: 200,
        responseTime: 100,
        dnsMs: 10,
        tcpMs: 20,
        tlsMs: 30,
        ttfbMs: 30,
        downloadMs: 10,
        sizeBytes: 4096,
      },
    });
    // Pre-feature check: no phase data (old agents / legacy rows)
    await prisma.check.create({
      data: {
        monitorId,
        type: "uptime",
        status: "up",
        statusCode: 200,
        responseTime: 80,
        checkedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // separate hourly bucket
      },
    });
  });

  it("returns per-phase averages for buckets with breakdown data", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/response-times?range=24h`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const withPhases = res.body.data.find((b: { avgTtfbMs: number | null }) => b.avgTtfbMs !== null);
    expect(withPhases).toBeDefined();
    expect(withPhases.avgDnsMs).toBe(10);
    expect(withPhases.avgTcpMs).toBe(20);
    expect(withPhases.avgTlsMs).toBe(30);
    expect(withPhases.avgTtfbMs).toBe(30);
    expect(withPhases.avgDownloadMs).toBe(10);
    expect(withPhases.avgSizeBytes).toBe(4096);
  });

  it("returns null phase averages for buckets without breakdown data", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/response-times?range=24h`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const legacy = res.body.data.find((b: { avgMs: number | null }) => b.avgMs === 80);
    expect(legacy).toBeDefined();
    expect(legacy.avgTtfbMs).toBeNull();
    expect(legacy.avgSizeBytes).toBeNull();
  });
});
