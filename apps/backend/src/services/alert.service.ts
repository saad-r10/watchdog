import { prisma } from "../db";
import { alertRepository } from "../repositories/alert.repository";
import { sendEmail, downtimeAlertHtml, sslAlertHtml, recoveryAlertHtml, ctAlertHtml, blocklistAlertHtml, contentChangeAlertHtml, syntheticFailureAlertHtml, syntheticRecoveryAlertHtml, performanceDegradedAlertHtml, performanceRecoveredAlertHtml, lighthouseBudgetAlertHtml, lighthouseRecoveryAlertHtml } from "./email.service";
import { sendWebhook, type WebhookPayload } from "./webhook.service";
import { sendSlackAlert } from "./slack.service";
import { sendDiscordAlert } from "./discord.service";
import { sendTelegramAlert } from "./telegram.service";
import { sendPushToUser } from "./push.service";
import type { CrtShEntry } from "../lib/crtsh";
import type { BlocklistFindings } from "../lib/blocklist-utils";
import type { Monitor, Incident } from "@prisma/client";
import type { SyntheticCheckResult, LighthouseResult } from "@watchdog/shared-types";
import type { AnomalyStats } from "../lib/anomaly-utils";

type ChatUser = {
  id: string;
  webhookUrl: string | null;
  slackWebhookUrl: string | null;
  discordWebhookUrl: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  alertWebPush: boolean;
};

function chatChannelPromises(user: ChatUser, payload: WebhookPayload): Promise<unknown>[] {
  return [
    user.webhookUrl ? sendWebhook(user.webhookUrl, payload) : Promise.resolve(),
    user.slackWebhookUrl ? sendSlackAlert(user.slackWebhookUrl, payload) : Promise.resolve(),
    user.discordWebhookUrl ? sendDiscordAlert(user.discordWebhookUrl, payload) : Promise.resolve(),
    user.telegramBotToken && user.telegramChatId
      ? sendTelegramAlert(user.telegramBotToken, user.telegramChatId, payload)
      : Promise.resolve(),
    user.alertWebPush ? sendPushToUser(user.id, payload) : Promise.resolve(),
  ];
}

const CHAT_SELECT = { id: true, webhookUrl: true, slackWebhookUrl: true, discordWebhookUrl: true, telegramBotToken: true, telegramChatId: true, alertWebPush: true } as const;

export const alertService = {
  async notifyDowntime(monitor: Monitor, incident: Incident): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertDowntime: true, ...CHAT_SELECT },
    });
    if (!user?.alertDowntime) return;

    const payload: WebhookPayload = { event: "downtime", monitorId: monitor.id, monitorName: monitor.name, monitorUrl: monitor.url, incidentId: incident.id, startedAt: incident.startedAt.toISOString() };
    await Promise.allSettled([
      sendEmail({ to: user.alertEmail ?? user.email, subject: `🔴 Down: ${monitor.name}`, html: downtimeAlertHtml(monitor.name, monitor.url, incident.startedAt) }),
      ...chatChannelPromises(user, payload),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id, type: "downtime" });
  },

  async notifyRecovery(monitor: Monitor, incident: Incident): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id, "recovery");
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertDowntime: true, ...CHAT_SELECT },
    });
    if (!user?.alertDowntime) return;

    const resolvedAt = incident.resolvedAt ?? new Date();
    const durationMinutes = incident.resolvedAt
      ? Math.round((incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 60_000)
      : null;

    const payload: WebhookPayload = { event: "recovery", monitorId: monitor.id, monitorName: monitor.name, monitorUrl: monitor.url, incidentId: incident.id, resolvedAt: resolvedAt.toISOString(), durationMinutes };
    await Promise.allSettled([
      sendEmail({ to: user.alertEmail ?? user.email, subject: `✅ Recovered: ${monitor.name}`, html: recoveryAlertHtml(monitor.name, monitor.url, resolvedAt, durationMinutes) }),
      ...chatChannelPromises(user, payload),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id, type: "recovery" });
  },

  async notifySslExpiry(monitor: Monitor, incident: Incident, daysLeft: number): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertSslExpiry: true, ...CHAT_SELECT },
    });
    if (!user?.alertSslExpiry) return;

    const payload: WebhookPayload = { event: "ssl_expiry", monitorId: monitor.id, monitorName: monitor.name, monitorUrl: monitor.url, incidentId: incident.id, message: `SSL certificate expires in ${daysLeft} days` };
    await Promise.allSettled([
      sendEmail({ to: user.alertEmail ?? user.email, subject: `🔒 SSL expiring in ${daysLeft} days: ${monitor.name}`, html: sslAlertHtml(monitor.name, monitor.url, daysLeft) }),
      ...chatChannelPromises(user, payload),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id });
  },

  async notifyUnexpectedCert(monitor: Monitor, incident: Incident, newCerts: CrtShEntry[]): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertCertTransparency: true, ...CHAT_SELECT },
    });
    if (!user?.alertCertTransparency) return;

    const payload: WebhookPayload = { event: "unexpected_cert", monitorId: monitor.id, monitorName: monitor.name, monitorUrl: monitor.url, incidentId: incident.id, message: `${newCerts.length} new certificate${newCerts.length === 1 ? "" : "s"} detected for ${monitor.url}` };
    await Promise.allSettled([
      sendEmail({ to: user.alertEmail ?? user.email, subject: `🔏 New certificate detected: ${monitor.name}`, html: ctAlertHtml(monitor.name, monitor.url, newCerts) }),
      ...chatChannelPromises(user, payload),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id });
  },

  async notifyDomainBlocklisted(monitor: Monitor, incident: Incident, findings: BlocklistFindings): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertBlocklist: true, ...CHAT_SELECT },
    });
    if (!user?.alertBlocklist) return;

    const sources = findings.sources.filter((s) => s.listed).map((s) => s.source);
    const payload: WebhookPayload = { event: "domain_blocklisted", monitorId: monitor.id, monitorName: monitor.name, monitorUrl: monitor.url, incidentId: incident.id, message: `${findings.hostname} appears on blocklist source(s): ${sources.join(", ")}` };
    await Promise.allSettled([
      sendEmail({ to: user.alertEmail ?? user.email, subject: `🚫 Domain blocklisted: ${monitor.name}`, html: blocklistAlertHtml(monitor.name, monitor.url, findings) }),
      ...chatChannelPromises(user, payload),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id });
  },

  async notifyContentChanged(monitor: Monitor, incident: Incident): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertContentChange: true, ...CHAT_SELECT },
    });
    if (!user?.alertContentChange) return;

    const payload: WebhookPayload = { event: "content_changed", monitorId: monitor.id, monitorName: monitor.name, monitorUrl: monitor.url, incidentId: incident.id, message: `Page content changed unexpectedly for ${monitor.url}` };
    await Promise.allSettled([
      sendEmail({ to: user.alertEmail ?? user.email, subject: `✏️ Content changed: ${monitor.name}`, html: contentChangeAlertHtml(monitor.name, monitor.url, incident.startedAt) }),
      ...chatChannelPromises(user, payload),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id });
  },

  async notifySyntheticFailure(monitor: Monitor, incident: Incident, result: SyntheticCheckResult): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertSyntheticFailure: true, ...CHAT_SELECT },
    });
    if (!user?.alertSyntheticFailure) return;

    const payload: WebhookPayload = { event: "synthetic_failure", monitorId: monitor.id, monitorName: monitor.name, monitorUrl: monitor.url, incidentId: incident.id, startedAt: incident.startedAt.toISOString() };
    await Promise.allSettled([
      sendEmail({ to: user.alertEmail ?? user.email, subject: `🔴 Transaction failed: ${monitor.name}`, html: syntheticFailureAlertHtml(monitor.name, monitor.url, incident.startedAt, result) }),
      ...chatChannelPromises(user, payload),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id, type: "downtime" });
  },

  async notifySyntheticRecovery(monitor: Monitor, incident: Incident): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id, "recovery");
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertSyntheticFailure: true, ...CHAT_SELECT },
    });
    if (!user?.alertSyntheticFailure) return;

    const resolvedAt = incident.resolvedAt ?? new Date();
    const durationMinutes = incident.resolvedAt
      ? Math.round((incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 60_000)
      : null;

    const payload: WebhookPayload = { event: "synthetic_recovery", monitorId: monitor.id, monitorName: monitor.name, monitorUrl: monitor.url, incidentId: incident.id, resolvedAt: resolvedAt.toISOString(), durationMinutes };
    await Promise.allSettled([
      sendEmail({ to: user.alertEmail ?? user.email, subject: `✅ Transaction recovered: ${monitor.name}`, html: syntheticRecoveryAlertHtml(monitor.name, monitor.url, resolvedAt, durationMinutes) }),
      ...chatChannelPromises(user, payload),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id, type: "recovery" });
  },

  async notifyPerformanceDegraded(monitor: Monitor, incident: Incident, stats: AnomalyStats & { latest: number }): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertPerformanceDegraded: true, ...CHAT_SELECT },
    });
    if (!user?.alertPerformanceDegraded) return;

    const latestMs = Math.round(stats.latest);
    const meanMs = Math.round(stats.mean);
    const thresholdMs = Math.round(stats.threshold);

    const payload: WebhookPayload = { event: "performance_degraded", monitorId: monitor.id, monitorName: monitor.name, monitorUrl: monitor.url, incidentId: incident.id, latestMs, meanMs, thresholdMs };
    await Promise.allSettled([
      sendEmail({ to: user.alertEmail ?? user.email, subject: `⚠️ Slow response times: ${monitor.name}`, html: performanceDegradedAlertHtml(monitor.name, monitor.url, latestMs, meanMs, thresholdMs, incident.startedAt) }),
      ...chatChannelPromises(user, payload),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id });
  },

  async notifyPerformanceRecovery(monitor: Monitor, incident: Incident): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id, "recovery");
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertPerformanceDegraded: true, ...CHAT_SELECT },
    });
    if (!user?.alertPerformanceDegraded) return;

    const resolvedAt = incident.resolvedAt ?? new Date();
    const durationMinutes = incident.resolvedAt
      ? Math.round((incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 60_000)
      : null;

    const payload: WebhookPayload = { event: "performance_recovery", monitorId: monitor.id, monitorName: monitor.name, monitorUrl: monitor.url, incidentId: incident.id, resolvedAt: resolvedAt.toISOString(), durationMinutes };
    await Promise.allSettled([
      sendEmail({ to: user.alertEmail ?? user.email, subject: `✅ Response times back to normal: ${monitor.name}`, html: performanceRecoveredAlertHtml(monitor.name, monitor.url, resolvedAt, durationMinutes) }),
      ...chatChannelPromises(user, payload),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id, type: "recovery" });
  },

  async notifyLighthouseBudgetExceeded(monitor: Monitor, incident: Incident, result: LighthouseResult): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id);
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertLighthouseBudget: true, ...CHAT_SELECT },
    });
    if (!user?.alertLighthouseBudget) return;

    const budgets = {
      performance: monitor.lighthousePerformanceBudget,
      accessibility: monitor.lighthouseAccessibilityBudget,
      bestPractices: monitor.lighthouseBestPracticesBudget,
      seo: monitor.lighthouseSeoBudget,
    };

    const payload: WebhookPayload = { event: "lighthouse_budget_exceeded", monitorId: monitor.id, monitorName: monitor.name, monitorUrl: monitor.url, incidentId: incident.id, startedAt: incident.startedAt.toISOString() };
    await Promise.allSettled([
      sendEmail({ to: user.alertEmail ?? user.email, subject: `⚠️ Lighthouse budget exceeded: ${monitor.name}`, html: lighthouseBudgetAlertHtml(monitor.name, monitor.url, result, budgets, incident.startedAt) }),
      ...chatChannelPromises(user, payload),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id });
  },

  async notifyLighthouseRecovery(monitor: Monitor, incident: Incident): Promise<void> {
    const alreadySent = await alertRepository.hasAlertForIncident(incident.id, "recovery");
    if (alreadySent) return;

    const user = await prisma.user.findUnique({
      where: { id: monitor.userId },
      select: { email: true, alertEmail: true, alertLighthouseBudget: true, ...CHAT_SELECT },
    });
    if (!user?.alertLighthouseBudget) return;

    const resolvedAt = incident.resolvedAt ?? new Date();
    const durationMinutes = incident.resolvedAt
      ? Math.round((incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 60_000)
      : null;

    const payload: WebhookPayload = { event: "lighthouse_recovery", monitorId: monitor.id, monitorName: monitor.name, monitorUrl: monitor.url, incidentId: incident.id, resolvedAt: resolvedAt.toISOString(), durationMinutes };
    await Promise.allSettled([
      sendEmail({ to: user.alertEmail ?? user.email, subject: `✅ Lighthouse scores back within budget: ${monitor.name}`, html: lighthouseRecoveryAlertHtml(monitor.name, monitor.url, resolvedAt, durationMinutes) }),
      ...chatChannelPromises(user, payload),
    ]);

    await alertRepository.create({ userId: monitor.userId, incidentId: incident.id, type: "recovery" });
  },
};
