import { prisma } from "../db";
import { alertRepository } from "../repositories/alert.repository";
import { sendEmail, downtimeAlertHtml, sslAlertHtml, recoveryAlertHtml, ctAlertHtml, blocklistAlertHtml } from "./email.service";
import { sendWebhook } from "./webhook.service";
import type { CrtShEntry } from "../lib/crtsh";
import type { BlocklistFindings } from "../lib/blocklist-utils";
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

  async notifyUnexpectedCert(monitor: Monitor, incident: Incident, newCerts: CrtShEntry[]): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertCertTransparency: true, webhookUrl: true },
    });
    if (!user?.alertCertTransparency) return;

    await Promise.allSettled([
      sendEmail({
        to: user.alertEmail ?? user.email,
        subject: `🔏 New certificate detected: ${monitor.name}`,
        html: ctAlertHtml(monitor.name, monitor.url, newCerts),
      }),
      user.webhookUrl
        ? sendWebhook(user.webhookUrl, {
            event: "unexpected_cert",
            monitorId: monitor.id,
            monitorName: monitor.name,
            monitorUrl: monitor.url,
            incidentId: incident.id,
            message: `${newCerts.length} new certificate${newCerts.length === 1 ? "" : "s"} detected for ${monitor.url}`,
          })
        : Promise.resolve(),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id });
  },

  async notifyDomainBlocklisted(monitor: Monitor, incident: Incident, findings: BlocklistFindings): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertBlocklist: true, webhookUrl: true },
    });
    if (!user?.alertBlocklist) return;

    const sources = findings.sources.filter((s) => s.listed).map((s) => s.source);

    await Promise.allSettled([
      sendEmail({
        to: user.alertEmail ?? user.email,
        subject: `🚫 Domain blocklisted: ${monitor.name}`,
        html: blocklistAlertHtml(monitor.name, monitor.url, findings),
      }),
      user.webhookUrl
        ? sendWebhook(user.webhookUrl, {
            event: "domain_blocklisted",
            monitorId: monitor.id,
            monitorName: monitor.name,
            monitorUrl: monitor.url,
            incidentId: incident.id,
            message: `${findings.hostname} appears on blocklist source(s): ${sources.join(", ")}`,
          })
        : Promise.resolve(),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id });
  },
};
