import request from "supertest";
import app from "../index";
import { prisma } from "../db";
import { userRepository } from "../repositories/user.repository";

const TEST_EMAIL = "test-gdpr@watchdog.test";
const TEST_EMAIL_2 = "test-gdpr2@watchdog.test";

beforeAll(() => {
  process.env.RATE_LIMIT_LOGIN_MAX = "999";
  process.env.RATE_LIMIT_REGISTER_MAX = "999";
  process.env.SKIP_HIBP_CHECK = "true";
});

afterAll(async () => {
  delete process.env.RATE_LIMIT_LOGIN_MAX;
  delete process.env.RATE_LIMIT_REGISTER_MAX;
  delete process.env.SKIP_HIBP_CHECK;
  await prisma.user.deleteMany({ where: { email: { in: [TEST_EMAIL, TEST_EMAIL_2] } } });
  await prisma.$disconnect();
});

async function registerAndLogin(email: string): Promise<string> {
  await request(app).post("/api/auth/register").send({ email, password: "password123", name: "GDPR Tester" });
  const res = await request(app).post("/api/auth/login").send({ email, password: "password123" });
  return res.body.token;
}

describe("DELETE /api/users/me", () => {
  let token: string;

  beforeAll(async () => {
    token = await registerAndLogin(TEST_EMAIL);
  });

  it("schedules account deletion and returns 202", async () => {
    const res = await request(app).delete("/api/users/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deletionScheduledAt).toBeDefined();
    const scheduled = new Date(res.body.data.deletionScheduledAt);
    const daysOut = (scheduled.getTime() - Date.now()) / 86_400_000;
    expect(daysOut).toBeGreaterThan(29);
    expect(daysOut).toBeLessThan(31);
  });

  it("sets deletionScheduledAt in the DB", async () => {
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(user?.deletionScheduledAt).not.toBeNull();
  });

  it("returns 409 when deletion is already scheduled", async () => {
    // re-login since refresh tokens were revoked
    const newToken = await registerAndLogin(TEST_EMAIL_2);
    // Schedule first deletion
    await request(app).delete("/api/users/me").set("Authorization", `Bearer ${newToken}`);
    // Schedule again — should 409
    const res2 = await request(app).delete("/api/users/me").set("Authorization", `Bearer ${newToken}`);
    expect(res2.status).toBe(409);
  });

  it("revokes refresh tokens on deletion scheduling", async () => {
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    if (!user) throw new Error("User not found");
    const tokens = await prisma.refreshToken.count({ where: { userId: user.id } });
    expect(tokens).toBe(0);
  });
});

describe("GET /api/users/me includes deletionScheduledAt", () => {
  it("returns deletionScheduledAt in profile", async () => {
    const token = await registerAndLogin(TEST_EMAIL_2);
    const res = await request(app).get("/api/users/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect("deletionScheduledAt" in res.body.data).toBe(true);
  });
});

describe("POST /api/users/me/cancel-deletion", () => {
  let token: string;

  beforeAll(async () => {
    // Register a fresh user
    await request(app).post("/api/auth/register").send({ email: "test-gdpr-cancel@watchdog.test", password: "password123", name: "Cancel Tester" });
    const res = await request(app).post("/api/auth/login").send({ email: "test-gdpr-cancel@watchdog.test", password: "password123" });
    token = res.body.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: "test-gdpr-cancel@watchdog.test" } });
  });

  it("returns 400 when no deletion is scheduled", async () => {
    const res = await request(app).post("/api/users/me/cancel-deletion").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("cancels a scheduled deletion", async () => {
    await request(app).delete("/api/users/me").set("Authorization", `Bearer ${token}`);
    // Re-login since refresh tokens were revoked
    const loginRes = await request(app).post("/api/auth/login").send({ email: "test-gdpr-cancel@watchdog.test", password: "password123" });
    const newToken = loginRes.body.token;
    const res = await request(app).post("/api/users/me/cancel-deletion").set("Authorization", `Bearer ${newToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const user = await prisma.user.findUnique({ where: { email: "test-gdpr-cancel@watchdog.test" } });
    expect(user?.deletionScheduledAt).toBeNull();
  });
});

describe("GET /api/users/me/export", () => {
  let token: string;

  beforeAll(async () => {
    token = await registerAndLogin("test-gdpr-export@watchdog.test");
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: "test-gdpr-export@watchdog.test" } });
  });

  it("returns 200 with JSON attachment and user data", async () => {
    const res = await request(app).get("/api/users/me/export").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("watchdog-export.json");
    expect(res.body.user).toBeDefined();
    expect(res.body.monitors).toBeDefined();
    expect(res.body.agents).toBeDefined();
    expect(res.body.statusPages).toBeDefined();
    expect(res.body.incidents).toBeDefined();
    expect(res.body.alerts).toBeDefined();
  });

  it("returns empty arrays when user has no resources", async () => {
    const res = await request(app).get("/api/users/me/export").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.monitors).toHaveLength(0);
    expect(res.body.agents).toHaveLength(0);
    expect(res.body.statusPages).toHaveLength(0);
  });
});

describe("data-retention worker — hard delete after grace period", () => {
  it("hard-deletes users whose deletionScheduledAt is in the past", async () => {
    const user = await prisma.user.create({
      data: {
        email: "test-gdpr-expired@watchdog.test",
        password: "hashed",
        name: "Expired",
        deletionScheduledAt: new Date(Date.now() - 1000),
      },
    });
    const due = await userRepository.findDueForDeletion();
    expect(due.some((u) => u.id === user.id)).toBe(true);
    await userRepository.hardDelete(user.id);
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found).toBeNull();
  });
});
