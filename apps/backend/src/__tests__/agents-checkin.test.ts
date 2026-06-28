import request from "supertest";
import app from "../index";
import { prisma } from "../db";

const TEST_EMAIL = "test-agent-checkin@watchdog.test";
let token: string;
let monitorId: string;
let agentId: string;
let agentKey: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  const reg = await request(app).post("/api/auth/register").send({
    email: TEST_EMAIL, password: "password123", name: "Agent Tester",
  });
  token = reg.body.token;

  const mon = await request(app)
    .post("/api/monitors")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Agent Monitored Site", url: "https://example.com" });
  monitorId = mon.body.data.id;

  const agent = await request(app)
    .post("/api/agents")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Test Agent" });
  agentId = agent.body.data.id;
  agentKey = agent.body.data.key;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

describe("POST /api/agents/checkin - timing breakdown", () => {
  it("accepts and persists phase timings + payload size", async () => {
    const res = await request(app)
      .post("/api/agents/checkin")
      .set("X-Agent-Key", agentKey)
      .send({
        results: [
          {
            monitorId,
            type: "uptime",
            status: "up",
            statusCode: 200,
            responseTime: 142,
            dnsMs: 4,
            tcpMs: 18,
            tlsMs: 41,
            ttfbMs: 65,
            downloadMs: 14,
            sizeBytes: 20480,
          },
        ],
      });
    expect(res.status).toBe(200);

    const check = await prisma.check.findFirst({
      where: { monitorId, ttfbMs: { not: null } },
      orderBy: { checkedAt: "desc" },
    });
    expect(check).not.toBeNull();
    expect(check!.dnsMs).toBe(4);
    expect(check!.tcpMs).toBe(18);
    expect(check!.tlsMs).toBe(41);
    expect(check!.ttfbMs).toBe(65);
    expect(check!.downloadMs).toBe(14);
    expect(check!.sizeBytes).toBe(20480);
    expect(check!.agentId).toBe(agentId);

    const assignment = await prisma.monitorAgent.findUnique({
      where: { monitorId_agentId: { monitorId, agentId } },
    });
    expect(assignment).not.toBeNull();
  });

  it("still accepts old-style payloads without timing fields (backward compat)", async () => {
    const res = await request(app)
      .post("/api/agents/checkin")
      .set("X-Agent-Key", agentKey)
      .send({
        results: [
          { monitorId, type: "uptime", status: "up", statusCode: 200, responseTime: 142 },
        ],
      });
    expect(res.status).toBe(200);
  });

  it("rejects checkins without an agent key", async () => {
    const res = await request(app)
      .post("/api/agents/checkin")
      .send({ results: [{ monitorId, type: "uptime", status: "up" }] });
    expect(res.status).toBe(401);
  });
});
