import { prisma } from "../db";
import { alertRepository } from "../repositories/alert.repository";
import { sendEmail, downtimeAlertHtml, sslAlertHtml, recoveryAlertHtml, ctAlertHtml, blocklistAlertHtml, contentChangeAlertHtml, syntheticFailureAlertHtml, syntheticRecoveryAlertHtml, performanceDegradedAlertHtml, performanceRecoveredAlertHtml } from "./email.service";
import { sendWebhook } from "./webhook.service";
import type { CrtShEntry } from "../lib/crtsh";
import type { BlocklistFindings } from "../lib/blocklist-utils";
import type { Monitor, Incident } from "@prisma/client";
import type { SyntheticCheckResult } from "@watchdog/shared-types";
import type { AnomalyStats } from "../lib/anomaly-utils";

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

  async notifyContentChanged(monitor: Monitor, incident: Incident): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertContentChange: true, webhookUrl: true },
    });
    if (!user?.alertContentChange) return;

    await Promise.allSettled([
      sendEmail({
        to: user.alertEmail ?? user.email,
        subject: `✏️ Content changed: ${monitor.name}`,
        html: contentChangeAlertHtml(monitor.name, monitor.url, incident.startedAt),
      }),
      user.webhookUrl
        ? sendWebhook(user.webhookUrl, {
            event: "content_changed",
            monitorId: monitor.id,
            monitorName: monitor.name,
            monitorUrl: monitor.url,
            incidentId: incident.id,
            message: `Page content changed unexpectedly for ${monitor.url}`,
          })
        : Promise.resolve(),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id });
  },

  async notifySyntheticFailure(monitor: Monitor, incident: Incident, result: SyntheticCheckResult): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertSyntheticFailure: true, webhookUrl: true },
    });
    if (!user?.alertSyntheticFailure) return;

    await Promise.allSettled([
      sendEmail({
        to: user.alertEmail ?? user.email,
        subject: `🔴 Transaction failed: ${monitor.name}`,
        html: syntheticFailureAlertHtml(monitor.name, monitor.url, incident.startedAt, result),
      }),
      user.webhookUrl
        ? sendWebhook(user.webhookUrl, {
            event: "synthetic_failure",
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

  async notifySyntheticRecovery(monitor: Monitor, incident: Incident): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id, "recovery");
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertSyntheticFailure: true, webhookUrl: true },
    });
    if (!user?.alertSyntheticFailure) return;

    const resolvedAt = incident.resolvedAt ?? new Date();
    const durationMinutes = incident.resolvedAt
      ? Math.round((incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 60_000)
      : null;

    await Promise.allSettled([
      sendEmail({
        to: user.alertEmail ?? user.email,
        subject: `✅ Transaction recovered: ${monitor.name}`,
        html: syntheticRecoveryAlertHtml(monitor.name, monitor.url, resolvedAt, durationMinutes),
      }),
      user.webhookUrl
        ? sendWebhook(user.webhookUrl, {
            event: "synthetic_recovery",
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

  async notifyPerformanceDegraded(monitor: Monitor, incident: Incident, stats: AnomalyStats & { latest: number }): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertPerformanceDegraded: true, webhookUrl: true },
    });
    if (!user?.alertPerformanceDegraded) return;

    const latestMs = Math.round(stats.latest);
    const meanMs = Math.round(stats.mean);
    const thresholdMs = Math.round(stats.threshold);

    await Promise.allSettled([
      sendEmail({
        to: user.alertEmail ?? user.email,
        subject: `⚠️ Slow response times: ${monitor.name}`,
        html: performanceDegradedAlertHtml(monitor.name, monitor.url, latestMs, meanMs, thresholdMs, incident.startedAt),
      }),
      user.webhookUrl
        ? sendWebhook(user.webhookUrl, {
            event: "performance_degraded",
            monitorId: monitor.id,
            monitorName: monitor.name,
            monitorUrl: monitor.url,
            incidentId: incident.id,
            latestMs,
            meanMs,
            thresholdMs,
          })
        : Promise.resolve(),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id });
  },

  async notifyPerformanceRecovery(monitor: Monitor, incident: Incident): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id, "recovery");
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertPerformanceDegraded: true, webhookUrl: true },
    });
    if (!user?.alertPerformanceDegraded) return;

    const resolvedAt = incident.resolvedAt ?? new Date();
    const durationMinutes = incident.resolvedAt
      ? Math.round((incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 60_000)
      : null;

    await Promise.allSettled([
      sendEmail({
        to: user.alertEmail ?? user.email,
        subject: `✅ Response times back to normal: ${monitor.name}`,
        html: performanceRecoveredAlertHtml(monitor.name, monitor.url, resolvedAt, durationMinutes),
      }),
      user.webhookUrl
        ? sendWebhook(user.webhookUrl, {
            event: "performance_recovery",
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
};
