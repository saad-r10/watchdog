import http from "node:http";
import https from "node:https";
import net from "node:net";

export interface PhaseTimings {
  /** DNS lookup duration. 0 when the host is an IP literal, null if the phase never ran. */
  dnsMs: number | null;
  /** TCP connect duration. */
  tcpMs: number | null;
  /** TLS handshake duration. Always null for http:// targets. */
  tlsMs: number | null;
  /** Time to first byte: end of handshake (or connect for http) until response headers. */
  ttfbMs: number | null;
  /** Response headers until last body byte. */
  downloadMs: number | null;
  /** Wall clock for the whole request, including all redirect hops. */
  totalMs: number;
  /** Raw bytes received for the final hop's body (on-the-wire / compressed size). */
  sizeBytes: number | null;
}

export interface TimedResponse {
  /** True when an HTTP response was fully received, regardless of status code. */
  ok: boolean;
  /** Final status code, or null on network error / timeout / redirect overflow. */
  statusCode: number | null;
  timings: PhaseTimings;
}

interface TimedRequestOptions {
  timeoutMs?: number;
  maxRedirects?: number;
}

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

/**
 * GET a URL while measuring per-phase timings via socket events.
 * Follows redirects (phases accumulate across hops), never rejects,
 * and disables keep-alive so every check measures a cold connection.
 */
export async function timedRequest(
  url: string,
  { timeoutMs = 10_000, maxRedirects = 5 }: TimedRequestOptions = {}
): Promise<TimedResponse> {
  const t0 = Date.now();
  const timings: PhaseTimings = {
    dnsMs: null,
    tcpMs: null,
    tlsMs: null,
    ttfbMs: null,
    downloadMs: null,
    totalMs: 0,
    sizeBytes: null,
  };

  const addPhase = (key: "dnsMs" | "tcpMs" | "tlsMs" | "ttfbMs" | "downloadMs", ms: number) => {
    timings[key] = (timings[key] ?? 0) + ms;
  };

  return new Promise((resolve) => {
    let settled = false;
    let activeReq: http.ClientRequest | null = null;

    const settle = (ok: boolean, statusCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      timings.totalMs = Date.now() - t0;
      resolve({ ok, statusCode, timings });
    };

    // One overall deadline spanning all redirect hops, like axios's `timeout`.
    const deadline = setTimeout(() => {
      activeReq?.destroy();
      settle(false, null);
    }, timeoutMs);

    const hop = (currentUrl: string, redirectsLeft: number) => {
      if (settled) return;

      let parsed: URL;
      try {
        parsed = new URL(currentUrl);
      } catch {
        settle(false, null);
        return;
      }
      const isHttps = parsed.protocol === "https:";
      const mod = isHttps ? https : http;

      const tHopStart = Date.now();
      let tLookup: number | null = null;
      let tConnect: number | null = null;
      let tHandshakeDone: number | null = null;

      const req = mod.get(
        parsed,
        {
          agent: false, // fresh connection per hop: DNS/TCP/TLS phases are always real
          headers: {
            Accept: "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate", // axios parity; body is discarded, never decompressed
            "User-Agent": "watchdog/1.0",
          },
        },
        (res) => {
          const tResponse = Date.now();
          addPhase("ttfbMs", tResponse - (tHandshakeDone ?? tConnect ?? tHopStart));

          const statusCode = res.statusCode ?? null;
          const location = res.headers.location;
          if (statusCode !== null && REDIRECT_CODES.has(statusCode) && location) {
            res.resume(); // drain; redirect bodies don't count toward sizeBytes
            res.on("end", () => {
              if (redirectsLeft <= 0) {
                settle(false, null); // redirect overflow → down (axios ERR_FR_TOO_MANY_REDIRECTS parity)
                return;
              }
              let nextUrl: string;
              try {
                nextUrl = new URL(location, parsed).toString();
              } catch {
                settle(false, null);
                return;
              }
              hop(nextUrl, redirectsLeft - 1);
            });
            res.on("error", () => settle(false, null));
            return;
          }

          let bytes = 0;
          res.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
          });
          res.on("end", () => {
            addPhase("downloadMs", Date.now() - tResponse);
            timings.sizeBytes = bytes;
            settle(true, statusCode);
          });
          res.on("error", () => settle(false, statusCode));
        }
      );
      activeReq = req;

      req.on("socket", (socket) => {
        if (net.isIP(parsed.hostname.replace(/^\[|\]$/g, ""))) {
          // IP literal: DNS cost nothing
          if (timings.dnsMs === null) timings.dnsMs = 0;
        } else {
          socket.once("lookup", () => {
            tLookup = Date.now();
            addPhase("dnsMs", tLookup - tHopStart);
          });
        }
        socket.once("connect", () => {
          tConnect = Date.now();
          addPhase("tcpMs", tConnect - (tLookup ?? tHopStart));
        });
        if (isHttps) {
          socket.once("secureConnect", () => {
            tHandshakeDone = Date.now();
            addPhase("tlsMs", tHandshakeDone - (tConnect ?? tHopStart));
          });
        }
      });

      req.on("error", () => settle(false, null));
    };

    hop(url, maxRedirects);
  });
}
