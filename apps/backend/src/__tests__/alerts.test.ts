import request from "supertest";
import app from "../index";
import { prisma } from "../db";

const TEST_EMAIL = "test-alerts@watchdog.test";
let token: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  const res = await request(app).post("/api/auth/register").send({
    email: TEST_EMAIL, password: "password123", name: "Alert Tester",
  });
  token = res.body.token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

describe("GET /api/users/me/settings", () => {
  it("returns default alert settings", async () => {
    const res = await request(app)
      .get("/api/users/me/settings")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.alertDowntime).toBe(true);
    expect(res.body.data.alertSslExpiry).toBe(true);
    expect(res.body.data.alertEmail).toBeNull();
  });
});

describe("PUT /api/users/me/settings", () => {
  it("updates alert email", async () => {
    const res = await request(app)
      .put("/api/users/me/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ alertEmail: "custom@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.data.alertEmail).toBe("custom@example.com");
  });

  it("disables downtime alerts", async () => {
    const res = await request(app)
      .put("/api/users/me/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ alertDowntime: false });
    expect(res.status).toBe(200);
    expect(res.body.data.alertDowntime).toBe(false);
  });

  it("rejects invalid email", async () => {
    const res = await request(app)
      .put("/api/users/me/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ alertEmail: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("accepts null to clear alert email", async () => {
    const res = await request(app)
      .put("/api/users/me/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ alertEmail: null });
    expect(res.status).toBe(200);
    expect(res.body.data.alertEmail).toBeNull();
  });
});
