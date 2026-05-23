import { prisma } from "../db";

export const maintenanceRepository = {
  async findUpcoming(monitorId: string) {
    return prisma.maintenanceWindow.findMany({
      where: { monitorId, endsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
    });
  },

  async findById(id: string) {
    return prisma.maintenanceWindow.findUnique({ where: { id } });
  },

  async create(data: { monitorId: string; startsAt: Date; endsAt: Date; description?: string }) {
    return prisma.maintenanceWindow.create({ data });
  },

  async delete(id: string) {
    return prisma.maintenanceWindow.delete({ where: { id } });
  },

  async isActive(monitorId: string): Promise<boolean> {
    const now = new Date();
    const count = await prisma.maintenanceWindow.count({
      where: { monitorId, startsAt: { lte: now }, endsAt: { gte: now } },
    });
    return count > 0;
  },
};
