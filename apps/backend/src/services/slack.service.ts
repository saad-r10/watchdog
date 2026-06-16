import axios from "axios";
import type { WebhookPayload } from "./webhook.service";

const EMOJI: Record<string, string> = {
  downtime: "🔴",
  recovery: "✅",
  ssl_expiry: "🔒",
  unexpected_cert: "🔏",
  domain_blocklisted: "🚫",
  content_changed: "✏️",
  synthetic_failure: "🔴",
  synthetic_recovery: "✅",
  performance_degraded: "⚠️",
  performance_recovery: "✅",
  lighthouse_budget_exceeded: "⚠️",
  lighthouse_recovery: "✅",
  test: "🔔",
};

function buildText(payload: WebhookPayload): string {
  const icon = EMOJI[payload.event] ?? "🔔";
  const name = payload.monitorName ?? "Unknown monitor";
  const url = payload.monitorUrl ?? "";

  switch (payload.event) {
    case "downtime":
      return `${icon} *${name}* is *down*\n${url}`;
    case "recovery":
      return `${icon} *${name}* has *recovered*${payload.durationMinutes != null ? ` after ${payload.durationMinutes} min` : ""}\n${url}`;
    case "ssl_expiry":
      return `${icon} SSL certificate expiring soon for *${name}*\n${url}`;
    case "unexpected_cert":
      return `${icon} New certificate detected for *${name}*\n${url}`;
    case "domain_blocklisted":
      return `${icon} *${name}* appears on a domain blocklist\n${url}`;
    case "content_changed":
      return `${icon} Page content changed unexpectedly for *${name}*\n${url}`;
    case "synthetic_failure":
      return `${icon} Scripted transaction *failed* for *${name}*\n${url}`;
    case "synthetic_recovery":
      return `${icon} Scripted transaction *recovered* for *${name}*\n${url}`;
    case "performance_degraded":
      return `${icon} *${name}* is responding slowly${payload.latestMs != null ? ` (${payload.latestMs}ms vs ${payload.meanMs}ms baseline)` : ""}\n${url}`;
    case "performance_recovery":
      return `${icon} *${name}* response times are back to normal\n${url}`;
    case "lighthouse_budget_exceeded":
      return `${icon} Lighthouse budget exceeded for *${name}*\n${url}`;
    case "lighthouse_recovery":
      return `${icon} Lighthouse scores recovered for *${name}*\n${url}`;
    default:
      return `${icon} Watchdog alert for *${name}*${payload.message ? `\n${payload.message}` : ""}`;
  }
}

export async function sendSlackAlert(webhookUrl: string, payload: WebhookPayload): Promise<void> {
  await axios.post(webhookUrl, { text: buildText(payload) }, {
    timeout: 10_000,
    headers: { "Content-Type": "application/json", "User-Agent": "Watchdog-Alerts/1.0" },
  });
}
