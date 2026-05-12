import { prisma } from "../db";
import type { Check, Prisma } from "@prisma/client";

export const checkRepository = {
  async create(data: Prisma.CheckCreateInput): Promise<Check> {
    return prisma.check.create({ data });
  },
  async findByMonitor(monitorId: string, limit = 50): Promise<Check[]> {
    return prisma.check.findMany({
      where: { monitorId, type: "uptime" },
      orderBy: { checkedAt: "desc" },
      take: limit,
    });
  },
  async getStats(monitorId: string, since: Date) {
    const checks = await prisma.check.findMany({
      where: { monitorId, type: "uptime", checkedAt: { gte: since } },
      select: { status: true, responseTime: true },
    });
    if (checks.length === 0) return { uptimePercent: null, avgResponseTime: null, totalChecks: 0 };

    const upCount = checks.filter((c) => c.status === "up").length;
    const withTime = checks.filter((c) => c.responseTime !== null);
    const avgResponseTime =
      withTime.length > 0
        ? Math.round(withTime.reduce((s, c) => s + c.responseTime!, 0) / withTime.length)
        : null;

    return {
      uptimePercent: Math.round((upCount / checks.length) * 1000) / 10,
      avgResponseTime,
      totalChecks: checks.length,
    };
  },
  async getLatest(monitorId: string): Promise<Check | null> {
    return prisma.check.findFirst({
      where: { monitorId, type: "uptime" },
      orderBy: { checkedAt: "desc" },
    });
  },
};
