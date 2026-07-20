import dns from "node:dns/promises";
import net from "node:net";

// Blocks loopback, RFC 1918 private ranges, link-local (169.254.x.x covers AWS/GCP/Azure
// instance-metadata endpoints), carrier-grade NAT (RFC 6598), and IPv6 equivalents.
const PRIVATE_PATTERNS = [
  /^127\./,                                         // IPv4 loopback
  /^0\./,                                           // "this" network
  /^10\./,                                          // RFC 1918 /8
  /^172\.(1[6-9]|2[0-9]|3[01])\./,                 // RFC 1918 /12
  /^192\.168\./,                                    // RFC 1918 /16
  /^169\.254\./,                                    // link-local / cloud metadata
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // CGNAT RFC 6598
  /^::1$/,                                          // IPv6 loopback
  /^fe80:/i,                                        // IPv6 link-local
  /^f[cd][0-9a-f]{2}:/i,                            // IPv6 unique-local (fc00::/7)
];

// Hostnames that always resolve to private addresses and should be blocked by name.
const BLOCKED_HOSTNAMES = new Set(["localhost", "ip6-localhost", "ip6-loopback"]);

function isPrivateIp(ip: string): boolean {
  const normalized = ip.replace(/^\[|\]$/g, "").toLowerCase();
  return PRIVATE_PATTERNS.some((re) => re.test(normalized));
}

export class SsrfError extends Error {
  constructor(reason: string) {
    super(`SSRF blocked: ${reason}`);
    this.name = "SsrfError";
  }
}

/**
 * Throws SsrfError if `url` points to a private/loopback/link-local address.
 * Resolves hostnames via DNS and checks every returned A/AAAA record.
 */
export async function assertSsrfSafe(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfError("invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrfError(`disallowed protocol ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new SsrfError(`blocked hostname ${hostname}`);
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new SsrfError(`private IP ${hostname}`);
    return;
  }

  // Resolve all A and AAAA records and reject if any are private.
  const [v4Result, v6Result] = await Promise.allSettled([
    dns.resolve4(hostname).catch((): string[] => []),
    dns.resolve6(hostname).catch((): string[] => []),
  ]);

  const addresses = [
    ...(v4Result.status === "fulfilled" ? v4Result.value : []),
    ...(v6Result.status === "fulfilled" ? v6Result.value : []),
  ];

  if (addresses.length === 0) throw new SsrfError(`cannot resolve ${hostname}`);

  for (const addr of addresses) {
    if (isPrivateIp(addr)) throw new SsrfError(`${hostname} resolves to private IP ${addr}`);
  }
}
