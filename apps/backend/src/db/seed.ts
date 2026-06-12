import { prisma } from "./index";
import bcrypt from "bcryptjs";

async function upsertMonitor(
  userId: string,
  name: string,
  url: string,
  intervalMinutes: number
) {
  const existing = await prisma.monitor.findFirst({ where: { userId, name } });
  if (existing) {
    return prisma.monitor.update({
      where: { id: existing.id },
      data: { url, intervalMinutes },
    });
  }
  return prisma.monitor.create({
    data: { userId, name, url, intervalMinutes },
  });
}

async function upsertIncident(
  monitorId: string,
  type: "downtime" | "ssl_expiry" | "header_missing",
  isResolved: boolean,
  data: object
) {
  const existing = await prisma.incident.findFirst({
    where: { monitorId, type, isResolved },
  });
  if (existing) {
    return prisma.incident.update({ where: { id: existing.id }, data });
  }
  return prisma.incident.create({
    data: { monitorId, type, isResolved, ...data } as any,
  });
}

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const user = await prisma.user.upsert({
    where: { email: "demo@watchdog.dev" },
    update: {
      password: passwordHash,
      name: "Demo User",
      alertEmail: "demo@watchdog.dev",
      alertDowntime: true,
      alertSslExpiry: true,
      webhookUrl: "http://localhost:3002/webhook",
    },
    create: {
      email: "demo@watchdog.dev",
      password: passwordHash,
      name: "Demo User",
      alertEmail: "demo@watchdog.dev",
      alertDowntime: true,
      alertSslExpiry: true,
      webhookUrl: "http://localhost:3002/webhook",
    },
  });

  const m1 = await upsertMonitor(user.id, "GitHub", "https://github.com", 1);
  const m2 = await upsertMonitor(user.id, "Example API", "https://httpbin.org/status/200", 5);
  const m3 = await upsertMonitor(user.id, "Broken Site", "https://httpbin.org/status/503", 5);
  const m4 = await upsertMonitor(user.id, "Agent Monitor", "https://internal.example.com", 5);

  await prisma.check.deleteMany({
    where: { monitorId: { in: [m1.id, m2.id, m3.id, m4.id] } },
  });

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // Plausible phase split for a given total response time
  function makePhases(responseTime: number) {
    const dnsMs = Math.floor(Math.random() * 19) + 2; // 2–20ms
    const tcpMs = Math.floor(Math.random() * 36) + 5; // 5–40ms
    const tlsMs = Math.floor(Math.random() * 51) + 10; // 10–60ms
    const remainder = Math.max(responseTime - dnsMs - tcpMs - tlsMs, 10);
    const ttfbMs = Math.round(remainder * 0.6);
    const downloadMs = remainder - ttfbMs;
    const sizeBytes = Math.floor(Math.random() * 195_000) + 5_000; // 5–200KB
    return { dnsMs, tcpMs, tlsMs, ttfbMs, downloadMs, sizeBytes };
  }

  function makeUptimeChecks(monitorId: string, count: number) {
    const interval = (now - thirtyDaysAgo) / count;
    const checks = Array.from({ length: count }, (_, i) => {
      const responseTime = Math.floor(Math.random() * 321) + 80;
      return {
        monitorId,
        type: "uptime" as const,
        status: "up",
        statusCode: 200,
        responseTime,
        // The oldest quarter stays phase-less to exercise the pre-feature fallback path
        ...(i >= count / 4 ? makePhases(responseTime) : {}),
        checkedAt: new Date(thirtyDaysAgo + i * interval),
      };
    });
    const downIndices = new Set<number>();
    while (downIndices.size < 8) {
      downIndices.add(Math.floor(Math.random() * count));
    }
    downIndices.forEach((i) => {
      checks[i].status = "down";
      checks[i].statusCode = 503;
    });
    return checks;
  }

  const m3Interval = (now - thirtyDaysAgo) / 60;
  const m3Checks = Array.from({ length: 60 }, (_, i) => ({
    monitorId: m3.id,
    type: "uptime" as const,
    status: "down",
    statusCode: 503,
    responseTime: Math.floor(Math.random() * 4001) + 5000,
    checkedAt: new Date(thirtyDaysAgo + i * m3Interval),
  }));

  await prisma.check.createMany({
    data: [...makeUptimeChecks(m1.id, 200), ...makeUptimeChecks(m2.id, 200), ...m3Checks],
  });

  await prisma.check.create({
    data: {
      monitorId: m1.id,
      type: "ssl",
      status: "valid",
      sslDaysLeft: 87,
      checkedAt: new Date(),
    },
  });

  await prisma.check.create({
    data: {
      monitorId: m1.id,
      type: "headers",
      status: "fail",
      headers: {
        present: { "strict-transport-security": "max-age=31536000" },
        missing: ["content-security-policy", "permissions-policy"],
      },
      checkedAt: new Date(),
    },
  });

  await upsertIncident(m3.id, "downtime", false, {
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  });

  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  await upsertIncident(m2.id, "downtime", true, {
    startedAt: fiveDaysAgo,
    resolvedAt: new Date(fiveDaysAgo.getTime() + 3 * 60 * 60 * 1000),
    isResolved: true,
  });

  // Agent: create or update by name+userId, then set keyHash from the full key
  let agent = await prisma.agent.findFirst({
    where: { userId: user.id, name: "Local Test Agent" },
  });

  if (!agent) {
    agent = await prisma.agent.create({
      data: {
        userId: user.id,
        name: "Local Test Agent",
        keyHash: `seed-placeholder-${Date.now()}`,
        lastSeenAt: new Date(Date.now() - 30_000),
      },
    });
  }

  // Hash the full key (wdg_<id>.secret) so verifyKey works correctly
  const agentKey = `wdg_${agent.id}.testsecret123`;
  const agentKeyHash = await bcrypt.hash(agentKey, 10);
  agent = await prisma.agent.update({
    where: { id: agent.id },
    data: { keyHash: agentKeyHash, lastSeenAt: new Date(Date.now() - 30_000) },
  });

  await prisma.monitor.update({ where: { id: m4.id }, data: { agentId: agent.id } });

  const statusPage = await prisma.statusPage.upsert({
    where: { slug: "demo-status" },
    update: { title: "Demo Status Page" },
    create: { userId: user.id, slug: "demo-status", title: "Demo Status Page" },
  });

  await prisma.statusPageMonitor.deleteMany({ where: { statusPageId: statusPage.id } });
  await prisma.statusPageMonitor.createMany({
    data: [
      { statusPageId: statusPage.id, monitorId: m1.id },
      { statusPageId: statusPage.id, monitorId: m2.id },
      { statusPageId: statusPage.id, monitorId: m3.id },
    ],
  });

  await prisma.maintenanceWindow.deleteMany({
    where: { monitorId: { in: [m1.id, m2.id] } },
  });

  await prisma.maintenanceWindow.create({
    data: {
      monitorId: m2.id,
      startsAt: new Date(Date.now() - 30 * 60 * 1000),
      endsAt: new Date(Date.now() + 30 * 60 * 1000),
      description: "Scheduled upgrade",
    },
  });

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(2, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setUTCHours(4, 0, 0, 0);

  await prisma.maintenanceWindow.create({
    data: {
      monitorId: m1.id,
      startsAt: tomorrow,
      endsAt: tomorrowEnd,
      description: "Planned maintenance",
    },
  });

  console.log(`
============================================
  WATCHDOG DEMO SEED COMPLETE

  Login:        demo@watchdog.dev / password123
  Monitors:     GitHub · Example API · Broken Site · Agent Monitor
  Agent key:    wdg_${agent.id}.testsecret123
  Status page:  http://localhost:5173/status/demo-status
  Webhook mock: http://localhost:3002/webhook
                (start with: cd apps/backend && npm run mock-webhook)
============================================
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
