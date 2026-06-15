import axios from "axios";

export interface WebhookPayload {
  event:
    | "downtime"
    | "recovery"
    | "ssl_expiry"
    | "unexpected_cert"
    | "domain_blocklisted"
    | "content_changed"
    | "synthetic_failure"
    | "synthetic_recovery"
    | "performance_degraded"
    | "performance_recovery"
    | "test";
  monitorId?: string;
  monitorName?: string;
  monitorUrl?: string;
  incidentId?: string;
  startedAt?: string;
  resolvedAt?: string;
  durationMinutes?: number | null;
  latestMs?: number;
  meanMs?: number;
  thresholdMs?: number;
  message?: string;
}

export async function sendWebhook(url: string, payload: WebhookPayload): Promise<void> {
  await axios.post(url, payload, {
    timeout: 10_000,
    headers: { "Content-Type": "application/json", "User-Agent": "Watchdog-Alerts/1.0" },
  });
}
