import { monitorRepository } from "../repositories/monitor.repository";

interface CreateInput {
  name: string;
  url: string;
  intervalMinutes?: number;
  agentId?: string;
}

export const monitorService = {
  async create(userId: string, input: CreateInput) {
    const { agentId, ...rest } = input;
    return monitorRepository.create({
      ...rest,
      user: { connect: { id: userId } },
      ...(agentId ? { agent: { connect: { id: agentId } } } : {}),
    });
  },
  async getById(id: string, userId: string) {
    const monitor = await monitorRepository.findById(id);
    if (!monitor || monitor.userId !== userId) {
      const err = new Error("Monitor not found") as any;
      err.status = 404;
      throw err;
    }
    return monitor;
  },
  async listByUser(userId: string) {
    return monitorRepository.findByUser(userId);
  },
  async update(id: string, userId: string, input: { name?: string; url?: string; intervalMinutes?: number; isActive?: boolean; paused?: boolean; agentId?: string | null }) {
    await monitorService.getById(id, userId);
    const { agentId, ...rest } = input;
    const data: Record<string, unknown> = { ...rest };
    if (agentId !== undefined) {
      data.agent = agentId ? { connect: { id: agentId } } : { disconnect: true };
    }
    return monitorRepository.update(id, data);
  },
  async delete(id: string, userId: string) {
    await monitorService.getById(id, userId);
    await monitorRepository.delete(id);
  },
};
