import crypto from "crypto";
import bcrypt from "bcryptjs";
import { agentRepository } from "../repositories/agent.repository";
import { checkRepository } from "../repositories/check.repository";

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
    return agentRepository.findByUser(userId);
  },

  async create(userId: string, name: string) {
    // Create with placeholder keyHash first to get the ID
    const placeholder = await agentRepository.create({
      userId,
      name,
      keyHash: "pending",
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

  async delete(id: string, userId: string) {
    const agent = await agentRepository.findById(id);
    if (!agent || agent.userId !== userId) {
      const err = new Error("Agent not found") as any;
      err.status = 404;
      throw err;
    }
    await agentRepository.delete(id);
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
      sslDaysLeft?: number;
      headers?: { present: string[]; missing: string[] };
      metricName?: string;
      metricValue?: number;
    }>
  ) {
    await agentRepository.updateLastSeen(agentId);

    await Promise.allSettled(
      results.map((r) =>
        checkRepository.create({
          monitor: { connect: { id: r.monitorId } },
          type: r.type,
          status: r.status,
          statusCode: r.statusCode,
          responseTime: r.responseTime,
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
  },
};
