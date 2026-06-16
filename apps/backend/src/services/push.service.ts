import webpush from "web-push";
import { prisma } from "../db";
import type { WebhookPayload } from "./webhook.service";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:alerts@watchdog.dev";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export async function sendPushToUser(userId: string, payload: WebhookPayload): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  const title = pushTitle(payload);
  const body = pushBody(payload);
  const data = JSON.stringify({ title, body, event: payload.event, monitorId: payload.monitorId });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data
        );
      } catch (err: unknown) {
        // 410 Gone = subscription expired — clean it up
        const webPushErr = err as { statusCode?: number };
        if (webPushErr?.statusCode === 410) {
          await prisma.pushSubscription.deleteMany({ where: { userId, endpoint: sub.endpoint } });
        }
      }
    })
  );
}

function pushTitle(p: WebhookPayload): string {
  switch (p.event) {
    case "downtime": return `Down: ${p.monitorName}`;
    case "recovery": return `Recovered: ${p.monitorName}`;
    case "ssl_expiry": return `SSL expiring: ${p.monitorName}`;
    case "unexpected_cert": return `New cert detected: ${p.monitorName}`;
    case "domain_blocklisted": return `Domain blocklisted: ${p.monitorName}`;
    case "content_changed": return `Content changed: ${p.monitorName}`;
    case "synthetic_failure": return `Transaction failed: ${p.monitorName}`;
    case "synthetic_recovery": return `Transaction recovered: ${p.monitorName}`;
    case "performance_degraded": return `Slow response: ${p.monitorName}`;
    case "performance_recovery": return `Response time normal: ${p.monitorName}`;
    case "lighthouse_budget_exceeded": return `Lighthouse budget exceeded: ${p.monitorName}`;
    case "lighthouse_recovery": return `Lighthouse scores recovered: ${p.monitorName}`;
    default: return `Watchdog alert: ${p.monitorName ?? "unknown"}`;
  }
}

function pushBody(p: WebhookPayload): string {
  if (p.message) return p.message;
  if (p.monitorUrl) return p.monitorUrl;
  return "View Watchdog for details.";
}
