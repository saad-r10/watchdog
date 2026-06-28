import axios from "axios";
import type { WebhookPayload } from "./webhook.service";

const COLOR: Record<string, number> = {
  downtime: 0xef4444,
  synthetic_failure: 0xef4444,
  recovery: 0x22c55e,
  synthetic_recovery: 0x22c55e,
  performance_recovery: 0x22c55e,
  lighthouse_recovery: 0x22c55e,
  ssl_expiry: 0xf59e0b,
  unexpected_cert: 0xf59e0b,
  performance_degraded: 0xf59e0b,
  lighthouse_budget_exceeded: 0xf59e0b,
  domain_blocklisted: 0x8b5cf6,
  content_changed: 0x3b82f6,
  test: 0x6b7280,
};

const TITLE: Record<string, string> = {
  downtime: "Site Down",
  recovery: "Site Recovered",
  ssl_expiry: "SSL Expiring Soon",
  unexpected_cert: "New Certificate Detected",
  domain_blocklisted: "Domain Blocklisted",
  content_changed: "Content Changed",
  synthetic_failure: "Transaction Failed",
  synthetic_recovery: "Transaction Recovered",
  performance_degraded: "Slow Response Times",
  performance_recovery: "Response Times Normal",
  lighthouse_budget_exceeded: "Lighthouse Budget Exceeded",
  lighthouse_recovery: "Lighthouse Scores Recovered",
  test: "Test Alert",
};

function buildDescription(payload: WebhookPayload): string {
  const url = payload.monitorUrl ? `\n${payload.monitorUrl}` : "";
  switch (payload.event) {
    case "recovery":
    case "synthetic_recovery":
    case "performance_recovery":
    case "lighthouse_recovery":
      return `Resolved after ${payload.durationMinutes != null ? `${payload.durationMinutes} minutes` : "some time"}${url}`;
    case "performance_degraded":
      return payload.latestMs != null
        ? `${payload.latestMs}ms vs ${payload.meanMs}ms baseline (threshold: ${payload.thresholdMs}ms)${url}`
        : url.trim();
    default:
      return payload.message ? `${payload.message}${url}` : url.trim();
  }
}

export async function sendDiscordAlert(webhookUrl: string, payload: WebhookPayload): Promise<void> {
  const embed = {
    title: `${TITLE[payload.event] ?? "Watchdog Alert"}${payload.monitorName ? ` - ${payload.monitorName}` : ""}`,
    description: buildDescription(payload) || undefined,
    color: COLOR[payload.event] ?? 0x6b7280,
    timestamp: new Date().toISOString(),
    footer: { text: "Watchdog" },
  };

  await axios.post(webhookUrl, { embeds: [embed] }, {
    timeout: 10_000,
    headers: { "Content-Type": "application/json", "User-Agent": "Watchdog-Alerts/1.0" },
  });
}
