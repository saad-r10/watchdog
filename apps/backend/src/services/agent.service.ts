import crypto from "crypto";
import bcrypt from "bcryptjs";
import { agentRepository } from "../repositories/agent.repository";
import { checkRepository } from "../repositories/check.repository";
import { monitorRepository } from "../repositories/monitor.repository";
import { monitorAgentRepository } from "../repositories/monitor-agent.repository";
import { monitorStatusService } from "./monitor-status.service";

function generateKey(agentId: string): string {
  const secret = crypto.randomBytes(24).toString("hex");
  return `wdg_${agentId}.${secret}`;
}

function parseAgentId(key: string): string | null {
  const match = key.match(/^wdg_([^.]+)\./);
  return match ? match[1] : null;
}

export const agentService = {
  async list(userId: string) {
    const agents = await agentRepository.findByUser(userId);
    return agents.map(({ monitorAgents, ...agent }) => ({
      ...agent,
      monitors: monitorAgents.map((ma) => ma.monitor),
    }));
  },

  async create(userId: string, name: string, region?: string | null) {
    // Create with a unique placeholder keyHash first to get the ID (keyHash has a unique constraint)
    const placeholder = await agentRepository.create({
      userId,
      name,
      keyHash: `pending-${crypto.randomUUID()}`,
      region,
    });

    const key = generateKey(placeholder.id);
    const keyHash = await bcrypt.hash(key, 10);

    // Update with real hash
    const agent = await (await import("../db")).prisma.agent.update({
      where: { id: placeholder.id },
      data: { keyHash },
    });

    return { agent, key };
  },

  async update(id: string, userId: string, data: { name?: string; region?: string | null }) {
    const agent = await agentRepository.findById(id);
    if (!agent || agent.userId !== userId) {
      const err = new Error("Agent not found") as any;
      err.status = 404;
      throw err;
    }
    return agentRepository.update(id, data, userId);
  },

  async delete(id: string, userId: string) {
    const agent = await agentRepository.findById(id);
    if (!agent || agent.userId !== userId) {
      const err = new Error("Agent not found") as any;
      err.status = 404;
      throw err;
    }
    await agentRepository.delete(id, userId);
  },

  async getConfig(agentId: string) {
    // A config fetch counts as a heartbeat - the agent is connected even if
    // no monitors are assigned yet.
    await agentRepository.updateLastSeen(agentId);
    const monitors = await monitorRepository.findByAgent(agentId);
    return monitors.map((m) => ({
      monitorId: m.id,
      url: m.url,
      intervalMinutes: m.intervalMinutes,
    }));
  },

  async verifyKey(key: string): Promise<string | null> {
    const agentId = parseAgentId(key);
    if (!agentId) return null;

    const agent = await agentRepository.findById(agentId);
    if (!agent) return null;

    const valid = await bcrypt.compare(key, agent.keyHash);
    return valid ? agent.id : null;
  },

  async recordCheckin(
    agentId: string,
    results: Array<{
      monitorId: string;
      type: "uptime" | "ssl" | "headers" | "metric";
      status: string;
      statusCode?: number;
      responseTime?: number;
      dnsMs?: number;
      tcpMs?: number;
      tlsMs?: number;
      ttfbMs?: number;
      downloadMs?: number;
      sizeBytes?: number;
      sslDaysLeft?: number;
      headers?: { present: string[]; missing: string[] };
      metricName?: string;
      metricValue?: number;
    }>
  ) {
    await agentRepository.updateLastSeen(agentId);

    // Auto-assign monitors to this agent on first checkin
    const monitorIds = [...new Set(results.map((r) => r.monitorId))];
    await Promise.allSettled(
      monitorIds.map(async (monitorId) => {
        const assigned = await monitorAgentRepository.exists(monitorId, agentId);
        if (!assigned) {
          await monitorAgentRepository.assign(monitorId, agentId);
        }
      })
    );

    await Promise.allSettled(
      results.map((r) =>
        checkRepository.create({
          monitor: { connect: { id: r.monitorId } },
          agent: { connect: { id: agentId } },
          type: r.type,
          status: r.status,
          statusCode: r.statusCode,
          responseTime: r.responseTime,
          dnsMs: r.dnsMs,
          tcpMs: r.tcpMs,
          tlsMs: r.tlsMs,
          ttfbMs: r.ttfbMs,
          downloadMs: r.downloadMs,
          sizeBytes: r.sizeBytes,
          sslDaysLeft: r.sslDaysLeft,
          headers: r.headers
            ? {
                present: Object.fromEntries(r.headers.present.map((h) => [h, "present"])),
                missing: r.headers.missing,
              }
            : undefined,
          metricName: r.metricName,
          metricValue: r.metricValue,
        })
      )
    );

    // Re-evaluate aggregate status for any monitors with a fresh uptime result
    const uptimeMonitorIds = [...new Set(results.filter((r) => r.type === "uptime").map((r) => r.monitorId))];
    await Promise.allSettled(
      uptimeMonitorIds.map(async (monitorId) => {
        const monitor = await monitorRepository.findById(monitorId);
        if (monitor) {
          await monitorStatusService.evaluateUptimeStatus(monitor);
        }
      })
    );
  },
};
