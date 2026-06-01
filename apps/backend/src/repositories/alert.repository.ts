import { prisma } from "../db";

export const alertRepository = {
  async hasAlertForIncident(incidentId: string, type: "downtime" | "recovery" = "downtime"): Promise<boolean> {
    const count = await prisma.alert.count({ where: { incidentId, type } });
    return count > 0;
  },
  async create(data: { userId: string; incidentId: string; type?: "downtime" | "recovery" }): Promise<void> {
    await prisma.alert.create({ data: { channel: "email", type: "downtime", ...data } });
  },

  async findRecentByUser(userId: string, limit = 20) {
    return prisma.alert.findMany({
      where: { userId },
      include: {
        incident: {
          include: {
            monitor: { select: { id: true, name: true, url: true } },
          },
        },
      },
      orderBy: { sentAt: "desc" },
      take: limit,
    });
  },
};
