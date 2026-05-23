import { prisma } from "../db";

export const statusPageRepository = {
  async findByUser(userId: string) {
    return prisma.statusPage.findMany({
      where: { userId },
      include: { monitors: { select: { monitorId: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async findBySlug(slug: string) {
    return prisma.statusPage.findUnique({
      where: { slug },
      include: {
        monitors: {
          include: { monitor: true },
        },
      },
    });
  },

  async findById(id: string) {
    return prisma.statusPage.findUnique({ where: { id } });
  },

  async create(data: { userId: string; slug: string; title: string }) {
    return prisma.statusPage.create({ data });
  },

  async delete(id: string) {
    return prisma.statusPage.delete({ where: { id } });
  },

  async setMonitors(statusPageId: string, monitorIds: string[]) {
    await prisma.statusPageMonitor.deleteMany({ where: { statusPageId } });
    if (monitorIds.length === 0) return;
    await prisma.statusPageMonitor.createMany({
      data: monitorIds.map((monitorId) => ({ statusPageId, monitorId })),
    });
  },

  async getDailyBars(monitorId: string): Promise<Array<{ date: string; uptimePercent: number | null }>> {
    const rows = await prisma.$queryRaw<Array<{ day: string; total: bigint; up_count: bigint }>>`
      SELECT
        TO_CHAR(DATE("checkedAt"), 'YYYY-MM-DD') AS day,
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) AS up_count
      FROM "Check"
      WHERE "monitorId" = ${monitorId}
        AND type = 'uptime'
        AND "checkedAt" >= NOW() - INTERVAL '90 days'
      GROUP BY DATE("checkedAt")
      ORDER BY day ASC
    `;

    const byDay = new Map(
      rows.map((r) => [
        r.day,
        Number(r.total) === 0
          ? null
          : Math.round((Number(r.up_count) / Number(r.total)) * 1000) / 10,
      ])
    );

    const bars: Array<{ date: string; uptimePercent: number | null }> = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      bars.push({ date: dateStr, uptimePercent: byDay.get(dateStr) ?? null });
    }
    return bars;
  },
};
