import { monitorRepository } from "../repositories/monitor.repository";
import { monitorAgentRepository } from "../repositories/monitor-agent.repository";
import { checkRepository } from "../repositories/check.repository";

const CLOUD_SOURCE = "__cloud__";

interface CreateInput {
  name: string;
  url: string;
  intervalMinutes?: number;
  agentId?: string;
}

interface MonitorWithAgents {
  monitorAgents?: Array<{ agent: { id: string; name: string; region: string | null; lastSeenAt: Date | null } }>;
  [key: string]: unknown;
}

function mapMonitor<T extends MonitorWithAgents>(monitor: T) {
  const { monitorAgents, ...rest } = monitor;
  return {
    ...rest,
    agents: (monitorAgents ?? []).map((ma) => ma.agent),
  };
}

export const monitorService = {
  async create(userId: string, input: CreateInput) {
    const { agentId, ...rest } = input;
    const monitor = await monitorRepository.create({
      ...rest,
      user: { connect: { id: userId } },
    });
    if (agentId) {
      await monitorAgentRepository.assign(monitor.id, agentId);
    }
    return monitorService.getById(monitor.id, userId);
  },
  async getById(id: string, userId: string) {
    const monitor = await monitorRepository.findById(id);
    if (!monitor || monitor.userId !== userId) {
      const err = new Error("Monitor not found") as any;
      err.status = 404;
      throw err;
    }
    return mapMonitor(monitor);
  },
  async listByUser(userId: string) {
    const monitors = await monitorRepository.findByUser(userId);
    return monitors.map(mapMonitor);
  },
  async update(
    id: string,
    userId: string,
    input: {
      name?: string;
      url?: string;
      intervalMinutes?: number;
      isActive?: boolean;
      paused?: boolean;
      contentChangeEnabled?: boolean;
      regionDownThreshold?: number;
    }
  ) {
    await monitorService.getById(id, userId);
    const monitor = await monitorRepository.update(id, input);
    return monitorService.getById(monitor.id, userId);
  },
  async delete(id: string, userId: string) {
    await monitorService.getById(id, userId);
    await monitorRepository.delete(id);
  },
  async snoozeContentChange(id: string, userId: string, hours: number) {
    await monitorService.getById(id, userId);
    return monitorRepository.update(id, {
      contentChangeSnoozeUntil: new Date(Date.now() + hours * 3_600_000),
    });
  },
  async assignAgent(monitorId: string, userId: string, agentId: string) {
    await monitorService.getById(monitorId, userId);
    await monitorAgentRepository.assign(monitorId, agentId);
    return monitorService.getById(monitorId, userId);
  },
  async unassignAgent(monitorId: string, userId: string, agentId: string) {
    await monitorService.getById(monitorId, userId);
    await monitorAgentRepository.unassign(monitorId, agentId);
    return monitorService.getById(monitorId, userId);
  },
  async getRegionStatus(id: string, userId: string) {
    const monitor = await monitorService.getById(id, userId);
    const agents = monitor.agents;
    const sources =
      agents.length > 0
        ? agents.map((a) => ({ agentId: a.id, label: a.region ?? a.name, region: a.region }))
        : [{ agentId: null, label: "Cloud", region: null }];

    const latest = await checkRepository.getLatestUptimePerSource(id);
    const latestBySource = new Map(latest.map((row) => [row.agentId ?? CLOUD_SOURCE, row]));

    return sources.map((source) => {
      const row = latestBySource.get(source.agentId ?? CLOUD_SOURCE);
      return {
        agentId: source.agentId,
        label: source.label,
        region: source.region,
        status: (row?.status as "up" | "down" | undefined) ?? null,
        statusCode: row?.statusCode ?? null,
        responseTime: row?.responseTime ?? null,
        checkedAt: row?.checkedAt ? row.checkedAt.toISOString() : null,
      };
    });
  },
};
