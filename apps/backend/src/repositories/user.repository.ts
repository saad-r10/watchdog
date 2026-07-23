import { prisma } from "../db";

export const userRepository = {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async scheduleDeletion(id: string, scheduledAt: Date) {
    return prisma.user.update({ where: { id }, data: { deletionScheduledAt: scheduledAt } });
  },

  async cancelDeletion(id: string) {
    return prisma.user.update({ where: { id }, data: { deletionScheduledAt: null } });
  },

  async findDueForDeletion() {
    return prisma.user.findMany({ where: { deletionScheduledAt: { lte: new Date() } } });
  },

  async hardDelete(id: string) {
    return prisma.user.delete({ where: { id } });
  },

  async exportData(id: string) {
    const [user, monitors, agents, statusPages, incidents, alerts] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      }),
      prisma.monitor.findMany({
        where: { userId: id },
        select: { id: true, name: true, url: true, type: true, intervalMinutes: true, createdAt: true },
      }),
      prisma.agent.findMany({
        where: { userId: id },
        select: { id: true, name: true, region: true, createdAt: true },
      }),
      prisma.statusPage.findMany({
        where: { userId: id },
        select: { id: true, slug: true, title: true, createdAt: true },
      }),
      prisma.incident.findMany({
        where: { monitor: { userId: id } },
        select: { id: true, monitorId: true, type: true, startedAt: true, resolvedAt: true, isResolved: true },
        orderBy: { startedAt: "desc" },
      }),
      prisma.alert.findMany({
        where: { userId: id },
        select: { id: true, incidentId: true, channel: true, type: true, sentAt: true },
        orderBy: { sentAt: "desc" },
      }),
    ]);

    return { user, monitors, agents, statusPages, incidents, alerts };
  },
};
