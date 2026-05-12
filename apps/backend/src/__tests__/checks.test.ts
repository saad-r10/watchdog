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
