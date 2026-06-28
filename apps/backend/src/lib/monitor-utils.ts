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

export interface CookieFinding {
  name: string;
  missingSecure: boolean;
  missingHttpOnly: boolean;
  missingSameSite: boolean;
}

export function analyseCookies(setCookieHeaders: string[] | undefined, isHttps: boolean): CookieFinding[] {
  if (!setCookieHeaders) return [];

  return setCookieHeaders.map((cookie) => {
    const attrs = cookie.split(";").map((p) => p.trim().toLowerCase());
    const name = cookie.split(";")[0].split("=")[0].trim();
    return {
      name,
      missingSecure: isHttps && !attrs.includes("secure"),
      missingHttpOnly: !attrs.includes("httponly"),
      missingSameSite: !attrs.some((a) => a.startsWith("samesite")),
    };
  });
}

export interface MixedContentFinding {
  url: string;
}

// Lightweight regex scan rather than full DOM parsing - negative lookbehind avoids
// false positives on attributes like data-src / ng-src.
const MIXED_CONTENT_REGEX = /(?<![\w-])(?:src|href)\s*=\s*["']http:\/\/[^"'\s>]+["']/gi;

export function analyseMixedContent(html: string | undefined, pageUrl: string): MixedContentFinding[] {
  if (!html || !pageUrl.toLowerCase().startsWith("https://")) return [];

  const found = new Set<string>();
  for (const match of html.matchAll(MIXED_CONTENT_REGEX)) {
    const url = match[0].replace(/^[^"']*["']/, "").replace(/["']$/, "");
    found.add(url);
  }

  return [...found].map((url) => ({ url }));
}
