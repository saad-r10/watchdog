import { monitorRepository } from "../repositories/monitor.repository";

interface CreateInput {
  name: string;
  url: string;
  intervalMinutes?: number;
}

export const monitorService = {
  async create(userId: string, input: CreateInput) {
    return monitorRepository.create({
      ...input,
      user: { connect: { id: userId } },
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
  async update(id: string, userId: string, input: { name?: string; url?: string; intervalMinutes?: number; isActive?: boolean }) {
    await monitorService.getById(id, userId);
    return monitorRepository.update(id, input);
  },
  async delete(id: string, userId: string) {
    await monitorService.getById(id, userId);
    await monitorRepository.delete(id);
  },
};
