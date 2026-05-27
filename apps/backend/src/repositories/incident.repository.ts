import { prisma } from "../db";
import type { Incident, Prisma } from "@prisma/client";

export const incidentRepository = {
  async create(data: Prisma.IncidentCreateInput): Promise<Incident> {
    return prisma.incident.create({ data });
  },
  async findOpenByMonitor(monitorId: string): Promise<Incident | null> {
    return prisma.incident.findFirst({
      where: { monitorId, isResolved: false, type: "downtime" },
      orderBy: { startedAt: "desc" },
    });
  },
  async findOpenSslIncident(monitorId: string): Promise<Incident | null> {
    return prisma.incident.findFirst({
      where: { monitorId, isResolved: false, type: "ssl_expiry" },
      orderBy: { startedAt: "desc" },
    });
  },
  async resolve(id: string): Promise<Incident> {
    return prisma.incident.update({
      where: { id },
      data: { isResolved: true, resolvedAt: new Date() },
    });
  },
  async findByMonitor(monitorId: string, limit = 20): Promise<Incident[]> {
    return prisma.incident.findMany({
      where: { monitorId },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  },

  async findRecentByUser(userId: string, limit = 15) {
    return prisma.incident.findMany({
      where: { monitor: { userId } },
      include: { monitor: { select: { name: true, url: true } } },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  },
};
