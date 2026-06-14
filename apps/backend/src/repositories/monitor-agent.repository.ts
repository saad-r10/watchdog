import { prisma } from "../db";

export const monitorAgentRepository = {
  async assign(monitorId: string, agentId: string) {
    return prisma.monitorAgent.upsert({
      where: { monitorId_agentId: { monitorId, agentId } },
      create: { monitorId, agentId },
      update: {},
    });
  },

  async unassign(monitorId: string, agentId: string) {
    await prisma.monitorAgent.deleteMany({ where: { monitorId, agentId } });
  },

  async exists(monitorId: string, agentId: string): Promise<boolean> {
    const found = await prisma.monitorAgent.findUnique({
      where: { monitorId_agentId: { monitorId, agentId } },
    });
    return found !== null;
  },

  async findAgentIdsByMonitor(monitorId: string): Promise<string[]> {
    const rows = await prisma.monitorAgent.findMany({
      where: { monitorId },
      select: { agentId: true },
    });
    return rows.map((r) => r.agentId);
  },

  async findAgentsByMonitor(monitorId: string) {
    const rows = await prisma.monitorAgent.findMany({
      where: { monitorId },
      include: { agent: { select: { id: true, name: true, region: true, lastSeenAt: true } } },
    });
    return rows.map((r) => r.agent);
  },
};
