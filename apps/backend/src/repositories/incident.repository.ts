import { prisma } from "../db";
import type { Incident, IncidentType, Prisma } from "@prisma/client";

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
  async findOpenBlocklistIncident(monitorId: string): Promise<Incident | null> {
    return prisma.incident.findFirst({
      where: { monitorId, isResolved: false, type: "domain_blocklisted" },
      orderBy: { startedAt: "desc" },
    });
  },
  async findOpenSyntheticIncident(monitorId: string): Promise<Incident | null> {
    return prisma.incident.findFirst({
      where: { monitorId, isResolved: false, type: "synthetic_failure" },
      orderBy: { startedAt: "desc" },
    });
  },
  async findOpenPerformanceIncident(monitorId: string): Promise<Incident | null> {
    return prisma.incident.findFirst({
      where: { monitorId, isResolved: false, type: "performance_degraded" },
      orderBy: { startedAt: "desc" },
    });
  },
  async findOpenLighthouseIncident(monitorId: string): Promise<Incident | null> {
    return prisma.incident.findFirst({
      where: { monitorId, isResolved: false, type: "lighthouse_budget_exceeded" },
      orderBy: { startedAt: "desc" },
    });
  },
  async resolve(id: string): Promise<Incident> {
    return prisma.incident.update({
      where: { id },
      data: { isResolved: true, resolvedAt: new Date() },
    });
  },
  async findLatestByType(monitorId: string, type: IncidentType): Promise<Incident | null> {
    return prisma.incident.findFirst({
      where: { monitorId, type },
      orderBy: { startedAt: "desc" },
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
