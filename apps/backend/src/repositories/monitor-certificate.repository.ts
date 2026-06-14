import { prisma } from "../db";
import type { MonitorCertificate, Prisma } from "@prisma/client";

export const monitorCertificateRepository = {
  async findByMonitor(monitorId: string): Promise<MonitorCertificate[]> {
    return prisma.monitorCertificate.findMany({ where: { monitorId } });
  },
  async findRecentByMonitor(monitorId: string, limit = 10): Promise<MonitorCertificate[]> {
    return prisma.monitorCertificate.findMany({
      where: { monitorId },
      orderBy: { firstSeenAt: "desc" },
      take: limit,
    });
  },
  async createMany(data: Prisma.MonitorCertificateCreateManyInput[]): Promise<void> {
    if (data.length === 0) return;
    await prisma.monitorCertificate.createMany({ data, skipDuplicates: true });
  },
};
