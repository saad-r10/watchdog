import { prisma } from "../db";
import type { Monitor, Prisma } from "@prisma/client";

const AGENT_SELECT = {
  monitorAgents: {
    include: { agent: { select: { id: true, name: true, region: true, lastSeenAt: true } } },
  },
} as const;

export const monitorRepository = {
  async create(data: Prisma.MonitorCreateInput): Promise<Monitor> {
    return prisma.monitor.create({ data });
  },
  async findById(id: string) {
    return prisma.monitor.findUnique({ where: { id }, include: AGENT_SELECT });
  },
  async findByUser(userId: string) {
    return prisma.monitor.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: AGENT_SELECT,
    });
  },
  async findAllActive(): Promise<Monitor[]> {
    return prisma.monitor.findMany({
      where: { isActive: true, paused: false, monitorAgents: { none: {} } },
    });
  },
  async findAllActiveHttp(): Promise<Monitor[]> {
    return prisma.monitor.findMany({
      where: { isActive: true, paused: false, type: "http", monitorAgents: { none: {} } },
    });
  },
  async findAllSynthetic(): Promise<Monitor[]> {
    return prisma.monitor.findMany({
      where: { isActive: true, paused: false, type: "synthetic" },
    });
  },
  async findAllLighthouseEnabled(): Promise<Monitor[]> {
    return prisma.monitor.findMany({
      where: { isActive: true, paused: false, type: "http", lighthouseEnabled: true },
    });
  },
  async findByAgent(agentId: string) {
    return prisma.monitor.findMany({
      where: { isActive: true, paused: false, monitorAgents: { some: { agentId } } },
      orderBy: { createdAt: "asc" },
      include: AGENT_SELECT,
    });
  },
  async update(id: string, data: Prisma.MonitorUpdateInput, userId?: string): Promise<Monitor> {
    const where = userId ? { id, userId } : { id };
    return prisma.monitor.update({ where, data });
  },
  async delete(id: string, userId?: string): Promise<void> {
    const where = userId ? { id, userId } : { id };
    await prisma.monitor.delete({ where });
  },
};
