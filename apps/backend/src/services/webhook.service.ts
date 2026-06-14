import axios from "axios";

export interface WebhookPayload {
  event: "downtime" | "recovery" | "ssl_expiry" | "unexpected_cert" | "test";
  monitorId?: string;
  monitorName?: string;
  monitorUrl?: string;
  incidentId?: string;
  startedAt?: string;
  resolvedAt?: string;
  durationMinutes?: number | null;
  message?: string;
}

export async function sendWebhook(url: string, payload: WebhookPayload): Promise<void> {
  await axios.post(url, payload, {
    timeout: 10_000,
    headers: { "Content-Type": "application/json", "User-Agent": "Watchdog-Alerts/1.0" },
  });
}
