import request from "supertest";
import app from "../index";
import { prisma } from "../db";

const TEST_EMAIL = "test-multi-region@watchdog.test";
let token: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  const reg = await request(app).post("/api/auth/register").send({
    email: TEST_EMAIL, password: "password123", name: "Multi Region Tester",
  });
  token = reg.body.token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

async function createMonitor(name: string) {
  const res = await request(app)
    .post("/api/monitors")
    .set("Authorization", `Bearer ${token}`)
    .send({ name, url: "https://example.com" });
  return res.body.data.id as string;
}

async function createAgent(name: string, region: string) {
  const res = await request(app)
    .post("/api/agents")
    .set("Authorization", `Bearer ${token}`)
    .send({ name, region });
  return { id: res.body.data.id as string, key: res.body.data.key as string };
}

function checkin(agentKey: string, monitorId: string, status: "up" | "down") {
  return request(app)
    .post("/api/agents/checkin")
    .set("X-Agent-Key", agentKey)
    .send({ results: [{ monitorId, type: "uptime", status }] });
}

async function getOpenIncidents(monitorId: string) {
  const res = await request(app)
    .get(`/api/monitors/${monitorId}/incidents`)
    .set("Authorization", `Bearer ${token}`);
  return res.body.data.filter((i: { isResolved: boolean }) => !i.isResolved);
}

describe("multi-region downtime thresholds", () => {
  it("opens an incident immediately for a single agent with the default threshold", async () => {
    const monitorId = await createMonitor("Single Agent Site");
    const agent = await createAgent("Solo Agent", "us-east");

    await checkin(agent.key, monitorId, "down");

    const open = await getOpenIncidents(monitorId);
    expect(open).toHaveLength(1);
    expect(open[0].type).toBe("downtime");
  });

  it("requires N regions down before opening an incident, and resolves once below threshold", async () => {
    const monitorId = await createMonitor("Multi Region Site");
    const agentA = await createAgent("Region A Agent", "us-east");
    const agentB = await createAgent("Region B Agent", "eu-west");

    await request(app)
      .post(`/api/monitors/${monitorId}/agents/${agentA.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send();
    await request(app)
      .post(`/api/monitors/${monitorId}/agents/${agentB.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send();

    await request(app)
      .patch(`/api/monitors/${monitorId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ regionDownThreshold: 2 });

    // Only region A down — below threshold, no incident yet
    await checkin(agentA.key, monitorId, "down");
    expect(await getOpenIncidents(monitorId)).toHaveLength(0);

    // Region B also down — threshold met, incident opens
    await checkin(agentB.key, monitorId, "down");
    const open = await getOpenIncidents(monitorId);
    expect(open).toHaveLength(1);
    expect(open[0].type).toBe("downtime");

    // Region A recovers — back below threshold, incident resolves
    await checkin(agentA.key, monitorId, "up");
    expect(await getOpenIncidents(monitorId)).toHaveLength(0);
  });
});
