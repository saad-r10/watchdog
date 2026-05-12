import request from "supertest";
import app from "../index";
import { prisma } from "../db";

const TEST_EMAIL = "test-security@watchdog.test";
let token: string;
let monitorId: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  const reg = await request(app).post("/api/auth/register").send({
    email: TEST_EMAIL, password: "password123", name: "Security Tester",
  });
  token = reg.body.token;

  const mon = await request(app)
    .post("/api/monitors")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Secure Site", url: "https://example.com" });
  monitorId = mon.body.data.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

describe("GET /api/monitors/:id/ssl", () => {
  it("returns null before any SSL checks", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/ssl`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it("returns SSL check data after a check is stored", async () => {
    await prisma.check.create({
      data: { monitorId, type: "ssl", status: "valid", sslDaysLeft: 90 },
    });
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/ssl`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.sslDaysLeft).toBe(90);
    expect(res.body.data.status).toBe("valid");
  });
});

describe("GET /api/monitors/:id/headers", () => {
  it("returns null before any header checks", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/headers`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it("returns header check data after a check is stored", async () => {
    await prisma.check.create({
      data: {
        monitorId,
        type: "headers",
        status: "fail",
        headers: {
          present: { "x-frame-options": "DENY" },
          missing: ["content-security-policy", "strict-transport-security"],
        },
      },
    });
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/headers`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("fail");
    const { missing } = res.body.data.headers;
    expect(missing).toContain("content-security-policy");
  });
});
