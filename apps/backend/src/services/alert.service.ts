import { prisma } from "../db";
import { alertRepository } from "../repositories/alert.repository";
import { sendEmail, downtimeAlertHtml, sslAlertHtml } from "./email.service";
import type { Monitor, Incident } from "@prisma/client";

export const alertService = {
  async notifyDowntime(monitor: Monitor, incident: Incident): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertDowntime: true },
    });
    if (!user?.alertDowntime) return;

    const to = user.alertEmail ?? user.email;
    await sendEmail({
      to,
      subject: `🔴 Down: ${monitor.name}`,
      html: downtimeAlertHtml(monitor.name, monitor.url, incident.startedAt),
    });

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id });
  },

  async notifySslExpiry(monitor: Monitor, incident: Incident, daysLeft: number): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertSslExpiry: true },
    });
    if (!user?.alertSslExpiry) return;

    const to = user.alertEmail ?? user.email;
    await sendEmail({
      to,
      subject: `🔒 SSL expiring in ${daysLeft} days: ${monitor.name}`,
      html: sslAlertHtml(monitor.name, monitor.url, daysLeft),
    });

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id });
  },
};
