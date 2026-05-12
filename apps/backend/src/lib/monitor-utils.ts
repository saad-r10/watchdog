export const SSL_EXPIRY_WARN_DAYS = 14;

export function getSslStatus(daysLeft: number): "valid" | "expiring_soon" | "expired" {
  if (daysLeft <= 0) return "expired";
  if (daysLeft <= SSL_EXPIRY_WARN_DAYS) return "expiring_soon";
  return "valid";
}

export function getUptimeStatus(statusCode: number | null): "up" | "down" {
  if (statusCode === null) return "down";
  return statusCode < 400 ? "up" : "down";
}

export function analyseHeaders(responseHeaders: Record<string, string | undefined>) {
  const SECURITY_HEADERS = [
    "x-frame-options",
    "content-security-policy",
    "strict-transport-security",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
  ];

  const present: Record<string, string> = {};
  const missing: string[] = [];

  for (const h of SECURITY_HEADERS) {
    const val = responseHeaders[h];
    if (val) present[h] = val;
    else missing.push(h);
  }

  return { present, missing, status: missing.length === 0 ? ("pass" as const) : ("fail" as const) };
}
