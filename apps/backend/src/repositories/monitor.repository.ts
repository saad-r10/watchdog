import { prisma } from "../db";
import type { Monitor, Prisma } from "@prisma/client";

export const monitorRepository = {
  async create(data: Prisma.MonitorCreateInput): Promise<Monitor> {
    return prisma.monitor.create({ data });
  },
  async findById(id: string): Promise<Monitor | null> {
    return prisma.monitor.findUnique({ where: { id } });
  },
  async findByUser(userId: string): Promise<Monitor[]> {
    return prisma.monitor.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  },
  async findAllActive(): Promise<Monitor[]> {
    return prisma.monitor.findMany({ where: { isActive: true, paused: false, agentId: null } });
  },
  async findByAgent(agentId: string): Promise<Monitor[]> {
    return prisma.monitor.findMany({
      where: { agentId, isActive: true, paused: false },
      orderBy: { createdAt: "asc" },
    });
  },
  async update(id: string, data: Prisma.MonitorUpdateInput): Promise<Monitor> {
    return prisma.monitor.update({ where: { id }, data });
  },
  async delete(id: string): Promise<void> {
    await prisma.monitor.delete({ where: { id } });
  },
};
