import nodemailer from "nodemailer";

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn("SMTP not configured — skipping email:", payload.subject);
    return;
  }
  const transport = createTransport();
  await transport.sendMail({
    from: process.env.ALERT_FROM_EMAIL ?? process.env.SMTP_USER,
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
