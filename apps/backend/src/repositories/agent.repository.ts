import { prisma } from "../db";

export const agentRepository = {
  async findByUser(userId: string) {
    return prisma.agent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.agent.findUnique({ where: { id } });
  },

  async create(data: { userId: string; name: string; keyHash: string }) {
    return prisma.agent.create({ data });
  },

  async delete(id: string) {
    return prisma.agent.delete({ where: { id } });
  },

  async updateLastSeen(id: string) {
    return prisma.agent.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });
  },

  async findAllHashes() {
    return prisma.agent.findMany({ select: { id: true, keyHash: true } });
  },
};
