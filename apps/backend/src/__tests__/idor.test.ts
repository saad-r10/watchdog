/**
 * IDOR (Insecure Direct Object Reference) test suite.
 *
 * Each test verifies that a resource owned by user A cannot be accessed
 * or modified using user B's JWT — every endpoint must scope lookups to
 * req.user.id and return 404 (not 403, to avoid leaking existence) when
 * the requesting user does not own the resource.
 */
import request from "supertest";
import app from "../index";
import { prisma } from "../db";


const USER_A = { email: "idor-user-a@watchdog.test", password: "password123!", name: "User A" };
const USER_B = { email: "idor-user-b@watchdog.test", password: "password123!", name: "User B" };

let tokenA: string;
let tokenB: string;
let monitorId: string;
let agentId: string;
let statusPageId: string;
let maintenanceWindowId: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [USER_A.email, USER_B.email] } } });

  const regA = await request(app).post("/api/auth/register").send(USER_A);
  tokenA = regA.body.token;
  const regB = await request(app).post("/api/auth/register").send(USER_B);
  tokenB = regB.body.token;

  // Create resources owned by user A
  const monRes = await request(app)
    .post("/api/monitors")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ name: "User A Monitor", url: "https://example.com" });
  monitorId = monRes.body.data.id;

  const agentRes = await request(app)
    .post("/api/agents")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ name: "User A Agent" });
  agentId = agentRes.body.data.id;

  const spRes = await request(app)
    .post("/api/status-pages")
    .set("Authorization", `Bearer ${tokenA}`)
    .send({ slug: "idor-test-page", title: "IDOR Test Page" });
  statusPageId = spRes.body.data.id;

  const mwRes = await request(app)
    .post(`/api/monitors/${monitorId}/maintenance`)
    .set("Authorization", `Bearer ${tokenA}`)
    .send({
      startsAt: new Date(Date.now() + 60_000).toISOString(),
      endsAt: new Date(Date.now() + 120_000).toISOString(),
    });
  maintenanceWindowId = mwRes.body.data.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [USER_A.email, USER_B.email] } } });
  await prisma.$disconnect();
});

// ─── Monitor IDOR ─────────────────────────────────────────────────────────────

describe("Monitor IDOR", () => {
  it("GET /api/monitors/:id — user B cannot read user A's monitor", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("PATCH /api/monitors/:id — user B cannot update user A's monitor", async () => {
    const res = await request(app)
      .patch(`/api/monitors/${monitorId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Hijacked" });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/monitors/:id — user B cannot delete user A's monitor", async () => {
    const res = await request(app)
      .delete(`/api/monitors/${monitorId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/monitors/:id/checks — user B cannot read user A's checks", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/checks`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/monitors/:id/incidents — user B cannot read user A's incidents", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/incidents`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/monitors/:id/ssl — user B cannot read user A's SSL check", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/ssl`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/monitors/:id/headers — user B cannot read user A's headers check", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/headers`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/monitors/:id/certs — user B cannot read user A's CT data", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/certs`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/monitors/:id/dns — user B cannot read user A's DNS data", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/dns`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/monitors/:id/exposure — user B cannot read user A's exposure data", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/exposure`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/monitors/:id/blocklist — user B cannot read user A's blocklist data", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/blocklist`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/monitors/:id/stats — user B cannot read user A's stats", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/stats`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("GET /api/monitors/:id/regions — user B cannot read user A's regions", async () => {
    const res = await request(app)
      .get(`/api/monitors/${monitorId}/regions`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });
});

// ─── Agent IDOR ───────────────────────────────────────────────────────────────

describe("Agent IDOR", () => {
  it("PATCH /api/agents/:id — user B cannot rename user A's agent", async () => {
    const res = await request(app)
      .patch(`/api/agents/${agentId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Hijacked" });
    expect(res.status).toBe(404);
  });

  it("DELETE /api/agents/:id — user B cannot delete user A's agent", async () => {
    const res = await request(app)
      .delete(`/api/agents/${agentId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });
});

// ─── Status Page IDOR ─────────────────────────────────────────────────────────

describe("Status Page IDOR", () => {
  it("DELETE /api/status-pages/:id — user B cannot delete user A's status page", async () => {
    const res = await request(app)
      .delete(`/api/status-pages/${statusPageId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("PUT /api/status-pages/:id/monitors — user B cannot modify user A's status page monitors", async () => {
    const res = await request(app)
      .put(`/api/status-pages/${statusPageId}/monitors`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ monitorIds: [] });
    expect(res.status).toBe(404);
  });
});

// ─── Maintenance Window IDOR ──────────────────────────────────────────────────

describe("Maintenance Window IDOR", () => {
  it("DELETE /api/monitors/:id/maintenance/:windowId — user B cannot delete user A's maintenance window", async () => {
    const res = await request(app)
      .delete(`/api/monitors/${monitorId}/maintenance/${maintenanceWindowId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    // monitor ownership check fires first → 404
    expect(res.status).toBe(404);
  });
});

// ─── List isolation ───────────────────────────────────────────────────────────

describe("List endpoint isolation", () => {
  it("GET /api/monitors — user B does not see user A's monitors", async () => {
    const res = await request(app)
      .get("/api/monitors")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((m: any) => m.id);
    expect(ids).not.toContain(monitorId);
  });

  it("GET /api/agents — user B does not see user A's agents", async () => {
    const res = await request(app)
      .get("/api/agents")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((a: any) => a.id);
    expect(ids).not.toContain(agentId);
  });

  it("GET /api/status-pages — user B does not see user A's status pages", async () => {
    const res = await request(app)
      .get("/api/status-pages")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((p: any) => p.id);
    expect(ids).not.toContain(statusPageId);
  });
});
