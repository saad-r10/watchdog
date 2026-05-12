import { prisma } from "../db";

export const alertRepository = {
  async hasAlertForIncident(incidentId: string): Promise<boolean> {
    const count = await prisma.alert.count({ where: { incidentId } });
    return count > 0;
  },
  async create(data: { userId: string; incidentId: string }): Promise<void> {
    await prisma.alert.create({ data: { ...data, channel: "email" } });
  },
};
