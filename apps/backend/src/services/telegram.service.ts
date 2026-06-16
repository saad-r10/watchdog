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

function buildMessage(payload: WebhookPayload): string {
  const icon = EMOJI[payload.event] ?? "🔔";
  const name = payload.monitorName ? `<b>${escapeHtml(payload.monitorName)}</b>` : "Unknown monitor";
  const url = payload.monitorUrl ? `\n${escapeHtml(payload.monitorUrl)}` : "";

  switch (payload.event) {
    case "downtime":
      return `${icon} ${name} is <b>down</b>${url}`;
    case "recovery":
      return `${icon} ${name} has <b>recovered</b>${payload.durationMinutes != null ? ` after ${payload.durationMinutes} min` : ""}${url}`;
    case "ssl_expiry":
      return `${icon} SSL certificate expiring soon for ${name}${url}`;
    case "unexpected_cert":
      return `${icon} New certificate detected for ${name}${url}`;
    case "domain_blocklisted":
      return `${icon} ${name} appears on a domain blocklist${url}`;
    case "content_changed":
      return `${icon} Page content changed unexpectedly for ${name}${url}`;
    case "synthetic_failure":
      return `${icon} Scripted transaction <b>failed</b> for ${name}${url}`;
    case "synthetic_recovery":
      return `${icon} Scripted transaction <b>recovered</b> for ${name}${url}`;
    case "performance_degraded":
      return `${icon} ${name} is responding slowly${payload.latestMs != null ? ` (${payload.latestMs}ms vs ${payload.meanMs}ms baseline)` : ""}${url}`;
    case "performance_recovery":
      return `${icon} ${name} response times are back to normal${url}`;
    case "lighthouse_budget_exceeded":
      return `${icon} Lighthouse budget exceeded for ${name}${url}`;
    case "lighthouse_recovery":
      return `${icon} Lighthouse scores recovered for ${name}${url}`;
    default:
      return `${icon} Watchdog alert for ${name}${payload.message ? `\n${escapeHtml(payload.message)}` : ""}`;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegramAlert(botToken: string, chatId: string, payload: WebhookPayload): Promise<void> {
  await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    chat_id: chatId,
    text: buildMessage(payload),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  }, {
    timeout: 10_000,
    headers: { "Content-Type": "application/json", "User-Agent": "Watchdog-Alerts/1.0" },
  });
}
