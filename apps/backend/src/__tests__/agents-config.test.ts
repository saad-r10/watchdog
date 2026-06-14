import request from "supertest";
import app from "../index";
import { prisma } from "../db";

const TEST_EMAIL = "test-agent-config@watchdog.test";
let token: string;
let agentId: string;
let agentKey: string;
let assignedMonitorId: string;
let unassignedMonitorId: string;
let pausedMonitorId: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  const reg = await request(app).post("/api/auth/register").send({
    email: TEST_EMAIL, password: "password123", name: "Agent Config Tester",
  });
  token = reg.body.token;

  const agent = await request(app)
    .post("/api/agents")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Config Test Agent" });
  agentId = agent.body.data.id;
  agentKey = agent.body.data.key;

  async function createMonitor(name: string, url: string) {
    const res = await request(app)
      .post("/api/monitors")
      .set("Authorization", `Bearer ${token}`)
      .send({ name, url });
    return res.body.data.id as string;
  }

  assignedMonitorId = await createMonitor("Internal App", "http://10.0.0.5:4000");
  unassignedMonitorId = await createMonitor("Public Site", "https://example.com");
  pausedMonitorId = await createMonitor("Paused Internal", "http://10.0.0.6:4000");

  await request(app)
    .post(`/api/monitors/${assignedMonitorId}/agents/${agentId}`)
    .set("Authorization", `Bearer ${token}`)
    .send();
  await request(app)
    .post(`/api/monitors/${pausedMonitorId}/agents/${agentId}`)
    .set("Authorization", `Bearer ${token}`)
    .send();
  await request(app)
    .patch(`/api/monitors/${pausedMonitorId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ paused: true });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

describe("GET /api/agents/config", () => {
  it("returns only the agent's active assigned monitors", async () => {
    const res = await request(app)
      .get("/api/agents/config")
      .set("X-Agent-Key", agentKey);

    expect(res.status).toBe(200);
    const monitors = res.body.data.monitors;
    expect(monitors).toHaveLength(1);
    expect(monitors[0]).toEqual({
      monitorId: assignedMonitorId,
      url: "http://10.0.0.5:4000",
      intervalMinutes: expect.any(Number),
    });
    const ids = monitors.map((m: { monitorId: string }) => m.monitorId);
    expect(ids).not.toContain(unassignedMonitorId);
    expect(ids).not.toContain(pausedMonitorId);
  });

  it("updates lastSeenAt so the agent shows as online before its first checkin", async () => {
    const before = new Date(Date.now() - 1000);
    await request(app).get("/api/agents/config").set("X-Agent-Key", agentKey);

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    expect(agent!.lastSeenAt).not.toBeNull();
    expect(agent!.lastSeenAt!.getTime()).toBeGreaterThan(before.getTime());
  });

  it("rejects requests without an agent key", async () => {
    const res = await request(app).get("/api/agents/config");
    expect(res.status).toBe(401);
  });

  it("rejects requests with an invalid agent key", async () => {
    const res = await request(app)
      .get("/api/agents/config")
      .set("X-Agent-Key", `wdg_${agentId}.wrongsecret`);
    expect(res.status).toBe(401);
  });
});
