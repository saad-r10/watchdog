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
  async findLatestByType(monitorId: string, type: "ssl" | "headers"): Promise<Check | null> {
    return prisma.check.findFirst({
      where: { monitorId, type },
      orderBy: { checkedAt: "desc" },
    });
  },

  async findResponseTimes(
    monitorId: string,
    range: "24h" | "7d" | "30d"
  ): Promise<Array<{ bucket: string; avgMs: number | null; minMs: number | null; maxMs: number | null; hasDown: boolean }>> {
    const truncMap = { "24h": "hour", "7d": "hour", "30d": "day" } as const;
    const intervalMap = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" } as const;
    const trunc = truncMap[range];
    const interval = intervalMap[range];

    const rows = await prisma.$queryRaw<
      Array<{ bucket: string; avg_ms: number | null; min_ms: number | null; max_ms: number | null; has_down: boolean }>
    >`
      SELECT
        DATE_TRUNC(${trunc}, "checkedAt") AS bucket,
        ROUND(AVG("responseTime"))::int    AS avg_ms,
        MIN("responseTime")                AS min_ms,
        MAX("responseTime")                AS max_ms,
        BOOL_OR(status = 'down')           AS has_down
      FROM "Check"
      WHERE "monitorId" = ${monitorId}
        AND type = 'uptime'
        AND "checkedAt" >= NOW() - INTERVAL ${interval}
      GROUP BY DATE_TRUNC(${trunc}, "checkedAt")
      ORDER BY bucket ASC
    `;

    return rows.map((r) => ({
      bucket: new Date(r.bucket).toISOString(),
      avgMs: r.avg_ms,
      minMs: r.min_ms,
      maxMs: r.max_ms,
      hasDown: r.has_down,
    }));
  },
};
