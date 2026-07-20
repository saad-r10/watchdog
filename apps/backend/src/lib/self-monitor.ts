import { prisma } from "../db";

export async function ensureSelfMonitor() {
  const selfUrl = process.env.WATCHDOG_SELF_URL;
  if (!selfUrl) return;

  const owner = await prisma.user.findFirst({
    where: { role: "owner" },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) return;

  const existing = await prisma.monitor.findFirst({
    where: { userId: owner.id, url: selfUrl },
  });
  if (existing) return;

  await prisma.monitor.create({
    data: {
      userId: owner.id,
      name: "Watchdog (self)",
      url: selfUrl,
      type: "http",
    },
  });

  console.log(`[self-monitor] Created self-monitor for ${selfUrl}`);
}
