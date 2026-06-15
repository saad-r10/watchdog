import { prisma } from "../db";
import { Prisma as PrismaClient } from "@prisma/client";
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
    // Exclude checks that fell within a maintenance window
    const checks = await prisma.$queryRaw<Array<{ status: string; responseTime: number | null }>>`
      SELECT status, "responseTime"
      FROM "Check"
      WHERE "monitorId" = ${monitorId}
        AND type = 'uptime'
        AND "checkedAt" >= ${since}
        AND NOT EXISTS (
          SELECT 1 FROM "MaintenanceWindow" mw
          WHERE mw."monitorId" = ${monitorId}
            AND mw."startsAt" <= "checkedAt"
            AND mw."endsAt"   >= "checkedAt"
        )
    `;

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
  async getLatestUptimePerSource(
    monitorId: string
  ): Promise<Array<{ agentId: string | null; status: string; statusCode: number | null; responseTime: number | null; checkedAt: Date }>> {
    return prisma.$queryRaw<
      Array<{ agentId: string | null; status: string; statusCode: number | null; responseTime: number | null; checkedAt: Date }>
    >`
      SELECT DISTINCT ON ("agentId") "agentId", status, "statusCode", "responseTime", "checkedAt"
      FROM "Check"
      WHERE "monitorId" = ${monitorId}
        AND type = 'uptime'
      ORDER BY "agentId", "checkedAt" DESC
    `;
  },
  async findLatestByType(monitorId: string, type: "ssl" | "headers" | "cert_transparency" | "dns" | "exposure" | "blocklist" | "synthetic"): Promise<Check | null> {
    return prisma.check.findFirst({
      where: { monitorId, type },
      orderBy: { checkedAt: "desc" },
    });
  },

  async findLatestPerMonitor(monitorIds: string[]): Promise<Array<{ monitorId: string; status: string; checkedAt: Date }>> {
    if (monitorIds.length === 0) return [];
    const idList = PrismaClient.join(monitorIds);
    return prisma.$queryRaw<Array<{ monitorId: string; status: string; checkedAt: Date }>>`
      SELECT DISTINCT ON ("monitorId") "monitorId", status, "checkedAt"
      FROM "Check"
      WHERE "monitorId"::text IN (${idList})
        AND type = 'uptime'
      ORDER BY "monitorId", "checkedAt" DESC
    `;
  },

  async getBulkUptimeStats(monitorIds: string[], days: number): Promise<Array<{ monitorId: string; upCount: number; total: number }>> {
    if (monitorIds.length === 0) return [];
    const since = new Date(Date.now() - days * 86_400_000);
    const [totalRows, upRows] = await Promise.all([
      prisma.check.groupBy({
        by: ["monitorId"],
        where: { monitorId: { in: monitorIds }, type: "uptime", checkedAt: { gte: since } },
        _count: { id: true },
      }),
      prisma.check.groupBy({
        by: ["monitorId"],
        where: { monitorId: { in: monitorIds }, type: "uptime", status: "up", checkedAt: { gte: since } },
        _count: { id: true },
      }),
    ]);
    const upMap = new Map(upRows.map((r) => [r.monitorId, r._count.id]));
    return totalRows.map((r) => ({
      monitorId: r.monitorId,
      upCount: upMap.get(r.monitorId) ?? 0,
      total: r._count.id,
    }));
  },

  async findResponseTimes(
    monitorId: string,
    range: "24h" | "7d" | "30d"
  ): Promise<
    Array<{
      bucket: string;
      avgMs: number | null;
      minMs: number | null;
      maxMs: number | null;
      avgDnsMs: number | null;
      avgTcpMs: number | null;
      avgTlsMs: number | null;
      avgTtfbMs: number | null;
      avgDownloadMs: number | null;
      avgSizeBytes: number | null;
      hasDown: boolean;
    }>
  > {
    const truncMap = { "24h": "hour", "7d": "hour", "30d": "day" } as const;
    const intervalMap = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" } as const;
    const trunc = truncMap[range];
    const interval = intervalMap[range];

    const rows = await prisma.$queryRaw<
      Array<{
        bucket: string;
        avg_ms: number | null;
        min_ms: number | null;
        max_ms: number | null;
        avg_dns_ms: number | null;
        avg_tcp_ms: number | null;
        avg_tls_ms: number | null;
        avg_ttfb_ms: number | null;
        avg_download_ms: number | null;
        avg_size_bytes: number | null;
        has_down: boolean;
      }>
    >`
      SELECT
        DATE_TRUNC(${trunc}, "checkedAt") AS bucket,
        ROUND(AVG("responseTime"))::int    AS avg_ms,
        MIN("responseTime")                AS min_ms,
        MAX("responseTime")                AS max_ms,
        ROUND(AVG("dnsMs"))::int           AS avg_dns_ms,
        ROUND(AVG("tcpMs"))::int           AS avg_tcp_ms,
        ROUND(AVG("tlsMs"))::int           AS avg_tls_ms,
        ROUND(AVG("ttfbMs"))::int          AS avg_ttfb_ms,
        ROUND(AVG("downloadMs"))::int      AS avg_download_ms,
        ROUND(AVG("sizeBytes"))::int       AS avg_size_bytes,
        BOOL_OR(status = 'down')           AS has_down
      FROM "Check"
      WHERE "monitorId" = ${monitorId}
        AND type = 'uptime'
        AND "checkedAt" >= NOW() - ${interval}::interval
      GROUP BY 1
      ORDER BY bucket ASC
    `;

    return rows.map((r) => ({
      bucket: new Date(r.bucket).toISOString(),
      avgMs: r.avg_ms,
      minMs: r.min_ms,
      maxMs: r.max_ms,
      avgDnsMs: r.avg_dns_ms,
      avgTcpMs: r.avg_tcp_ms,
      avgTlsMs: r.avg_tls_ms,
      avgTtfbMs: r.avg_ttfb_ms,
      avgDownloadMs: r.avg_download_ms,
      avgSizeBytes: r.avg_size_bytes,
      hasDown: r.has_down,
    }));
  },
};
