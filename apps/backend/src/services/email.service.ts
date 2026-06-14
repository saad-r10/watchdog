import { Resend } from "resend";
import type { CrtShEntry } from "../lib/crtsh";

let resend: Resend | null = null;

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const client = getClient();
  if (!client) {
    console.warn("RESEND_API_KEY not configured — skipping email:", payload.subject);
    return;
  }
  await client.emails.send({
    from: process.env.ALERT_FROM_EMAIL ?? "alerts@watchdog.dev",
    ...payload,
  });
}

export function downtimeAlertHtml(monitorName: string, url: string, startedAt: Date): string {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <div style="background:#ef4444;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;font-size:18px">🔴 Site Down — ${monitorName}</h2>
      </div>
      <div style="border:1px solid #fca5a5;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 12px;color:#374151">
          <strong>${url}</strong> is currently <strong style="color:#ef4444">unreachable</strong>.
        </p>
        <p style="margin:0 0 12px;color:#6b7280;font-size:14px">
          Incident started: ${startedAt.toLocaleString()}
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px">
          You'll receive another alert when the site recovers.
        </p>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">
        Watchdog — Uptime &amp; Security Monitor
      </p>
    </div>
  `;
}

export function recoveryAlertHtml(monitorName: string, url: string, resolvedAt: Date, durationMinutes: number | null): string {
  const duration = durationMinutes != null
    ? durationMinutes < 60
      ? `${durationMinutes} minute${durationMinutes === 1 ? "" : "s"}`
      : `${Math.round(durationMinutes / 60)} hour${Math.round(durationMinutes / 60) === 1 ? "" : "s"}`
    : null;
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <div style="background:#22c55e;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;font-size:18px">✅ Recovered — ${monitorName}</h2>
      </div>
      <div style="border:1px solid #86efac;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 12px;color:#374151">
          <strong>${url}</strong> is back <strong style="color:#22c55e">online</strong>.
        </p>
        ${duration ? `<p style="margin:0 0 12px;color:#6b7280;font-size:14px">Outage duration: ${duration}</p>` : ""}
        <p style="margin:0;color:#6b7280;font-size:13px">
          Recovered at: ${resolvedAt.toLocaleString()}
        </p>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">
        Watchdog — Uptime &amp; Security Monitor
      </p>
    </div>
  `;
}

export function verifyEmailHtml(verifyUrl: string, name: string): string {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <div style="background:#7c3aed;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;font-size:18px">👋 Verify your email, ${name}</h2>
      </div>
      <div style="border:1px solid #ddd6fe;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 16px;color:#374151">
          Thanks for signing up for Watchdog. Click the button below to verify your email address.
        </p>
        <a href="${verifyUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
          Verify email
        </a>
        <p style="margin:16px 0 0;color:#6b7280;font-size:13px">
          This link expires in 24 hours. If you didn't create a Watchdog account, you can safely ignore this email.
        </p>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">
        Watchdog — Uptime &amp; Security Monitor
      </p>
    </div>
  `;
}

export function passwordResetHtml(resetUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <div style="background:#7c3aed;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;font-size:18px">🔑 Reset your password</h2>
      </div>
      <div style="border:1px solid #ddd6fe;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 16px;color:#374151">
          We received a request to reset your Watchdog password. Click the button below to choose a new one.
        </p>
        <a href="${resetUrl}" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
          Reset password
        </a>
        <p style="margin:16px 0 0;color:#6b7280;font-size:13px">
          This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.
        </p>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">
        Watchdog — Uptime &amp; Security Monitor
      </p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ctAlertHtml(monitorName: string, url: string, newCerts: CrtShEntry[]): string {
  const items = newCerts
    .slice(0, 10)
    .map(
      (c) => `
        <li style="margin-bottom:8px">
          <strong>${escapeHtml(c.common_name)}</strong><br/>
          <span style="color:#6b7280;font-size:13px">Issuer: ${escapeHtml(c.issuer_name)}</span><br/>
          <span style="color:#6b7280;font-size:13px">Valid: ${escapeHtml(c.not_before)} → ${escapeHtml(c.not_after)}</span>
        </li>`
    )
    .join("");

  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <div style="background:#f59e0b;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;font-size:18px">🔏 New Certificate Detected — ${monitorName}</h2>
      </div>
      <div style="border:1px solid #fcd34d;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 12px;color:#374151">
          ${newCerts.length} new certificate${newCerts.length === 1 ? "" : "s"} appeared in Certificate
          Transparency logs for <strong>${escapeHtml(url)}</strong>:
        </p>
        <ul style="margin:0 0 12px;padding-left:20px;color:#374151;font-size:14px">${items}</ul>
        <p style="margin:0;color:#6b7280;font-size:14px">
          If you don't recognize these certificates, this could indicate a compromised DNS provider,
          a phishing subdomain, or unauthorized cert issuance — investigate promptly.
        </p>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">
        Watchdog — Uptime &amp; Security Monitor
      </p>
    </div>
  `;
}

export function sslAlertHtml(monitorName: string, url: string, daysLeft: number): string {
  const urgent = daysLeft <= 3;
  const colour = urgent ? "#ef4444" : "#f59e0b";
  const label = urgent ? "URGENT" : "WARNING";
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <div style="background:${colour};color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;font-size:18px">🔒 SSL Expiry ${label} — ${monitorName}</h2>
      </div>
      <div style="border:1px solid #fcd34d;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 12px;color:#374151">
          The SSL certificate for <strong>${url}</strong> expires in
          <strong style="color:${colour}">${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>.
        </p>
        <p style="margin:0;color:#6b7280;font-size:14px">
          Renew your certificate immediately to avoid downtime and browser security warnings.
        </p>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px">
        Watchdog — Uptime &amp; Security Monitor
      </p>
    </div>
  `;
}
