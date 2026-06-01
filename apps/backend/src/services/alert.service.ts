import { prisma } from "../db";
import { alertRepository } from "../repositories/alert.repository";
import { sendEmail, downtimeAlertHtml, sslAlertHtml, recoveryAlertHtml } from "./email.service";
import { sendWebhook } from "./webhook.service";
import type { Monitor, Incident } from "@prisma/client";

export const alertService = {
  async notifyDowntime(monitor: Monitor, incident: Incident): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertDowntime: true, webhookUrl: true },
    });
    if (!user?.alertDowntime) return;

    await Promise.allSettled([
      sendEmail({
        to: user.alertEmail ?? user.email,
        subject: `🔴 Down: ${monitor.name}`,
        html: downtimeAlertHtml(monitor.name, monitor.url, incident.startedAt),
      }),
      user.webhookUrl
        ? sendWebhook(user.webhookUrl, {
            event: "downtime",
            monitorId: monitor.id,
            monitorName: monitor.name,
            monitorUrl: monitor.url,
            incidentId: incident.id,
            startedAt: incident.startedAt.toISOString(),
          })
        : Promise.resolve(),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id, type: "downtime" });
  },

  async notifyRecovery(monitor: Monitor, incident: Incident): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id, "recovery");
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertDowntime: true, webhookUrl: true },
    });
    if (!user?.alertDowntime) return;

    const resolvedAt = incident.resolvedAt ?? new Date();
    const durationMinutes = incident.resolvedAt
      ? Math.round((incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 60_000)
      : null;

    await Promise.allSettled([
      sendEmail({
        to: user.alertEmail ?? user.email,
        subject: `✅ Recovered: ${monitor.name}`,
        html: recoveryAlertHtml(monitor.name, monitor.url, resolvedAt, durationMinutes),
      }),
      user.webhookUrl
        ? sendWebhook(user.webhookUrl, {
            event: "recovery",
            monitorId: monitor.id,
            monitorName: monitor.name,
            monitorUrl: monitor.url,
            incidentId: incident.id,
            resolvedAt: resolvedAt.toISOString(),
            durationMinutes,
          })
        : Promise.resolve(),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id, type: "recovery" });
  },

  async notifySslExpiry(monitor: Monitor, incident: Incident, daysLeft: number): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertSslExpiry: true, webhookUrl: true },
    });
    if (!user?.alertSslExpiry) return;

    await Promise.allSettled([
      sendEmail({
        to: user.alertEmail ?? user.email,
        subject: `🔒 SSL expiring in ${daysLeft} days: ${monitor.name}`,
        html: sslAlertHtml(monitor.name, monitor.url, daysLeft),
      }),
      user.webhookUrl
        ? sendWebhook(user.webhookUrl, {
            event: "ssl_expiry",
            monitorId: monitor.id,
            monitorName: monitor.name,
            monitorUrl: monitor.url,
            incidentId: incident.id,
            message: `SSL certificate expires in ${daysLeft} days`,
          })
        : Promise.resolve(),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id });
  },
};
