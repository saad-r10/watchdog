import axios from "axios";
import { promises as dns } from "dns";

const REQUEST_TIMEOUT = 15_000;
const URLHAUS_HOSTFILE_URL = "https://urlhaus.abuse.ch/downloads/hostfile/";

// URLhaus publishes a single bulk hostfile rather than a per-domain lookup API —
// cache it across a worker run (and a little beyond) to avoid re-downloading
// it once per monitor and to stay within abuse.ch's fair-use expectations.
const URLHAUS_CACHE_TTL_MS = 60 * 60 * 1000;

export interface BlocklistSourceFinding {
  source: "urlhaus" | "spamhaus_dbl";
  listed: boolean;
  detail: string | null;
}

export interface BlocklistFindings {
  hostname: string;
  sources: BlocklistSourceFinding[];
}

export interface BlocklistAnalysisResult extends BlocklistFindings {
  status: "clean" | "listed";
}

// Spamhaus DBL return codes: https://www.spamhaus.org/faq/section/Spamhaus%20DBL
const SPAMHAUS_DBL_CODES: Record<string, string> = {
  "127.0.1.2": "spam domain",
  "127.0.1.4": "phishing domain",
  "127.0.1.5": "malware domain",
  "127.0.1.6": "botnet C2 domain",
  "127.0.1.102": "abused legit spam",
  "127.0.1.103": "abused legit phishing",
  "127.0.1.104": "abused legit malware",
  "127.0.1.105": "abused legit botnet C2",
};

let urlhausCache: { hosts: Set<string>; fetchedAt: number } | null = null;

async function fetchUrlhausHosts(): Promise<Set<string>> {
  if (urlhausCache && Date.now() - urlhausCache.fetchedAt < URLHAUS_CACHE_TTL_MS) {
    return urlhausCache.hosts;
  }

  const res = await axios.get<string>(URLHAUS_HOSTFILE_URL, {
    timeout: REQUEST_TIMEOUT,
    headers: { "User-Agent": "Watchdog-BlocklistWorker/1.0" },
    responseType: "text",
  });

  const hosts = new Set<string>();
  for (const line of res.data.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // Format: "127.0.0.1\t<hostname>"
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) hosts.add(parts[1].toLowerCase());
  }

  urlhausCache = { hosts, fetchedAt: Date.now() };
  return hosts;
}

export async function checkUrlhaus(hostname: string): Promise<BlocklistSourceFinding> {
  try {
    const hosts = await fetchUrlhausHosts();
    const listed = hosts.has(hostname.toLowerCase());
    return {
      source: "urlhaus",
      listed,
      detail: listed ? "Hostname appears in the URLhaus malware/phishing host blocklist" : null,
    };
  } catch {
    return { source: "urlhaus", listed: false, detail: null };
  }
}

export async function checkSpamhausDbl(hostname: string): Promise<BlocklistSourceFinding> {
  try {
    const addresses = await dns.resolve4(`${hostname}.dbl.spamhaus.org`);
    const code = addresses[0];
    const reason = SPAMHAUS_DBL_CODES[code] ?? `listed (code ${code})`;
    return { source: "spamhaus_dbl", listed: true, detail: `Spamhaus DBL: ${reason}` };
  } catch {
    // NXDOMAIN means the domain isn't listed; other DNS errors are treated
    // the same way to avoid false positives from transient lookup failures.
    return { source: "spamhaus_dbl", listed: false, detail: null };
  }
}

export async function analyseBlocklist(hostname: string): Promise<BlocklistAnalysisResult> {
  const [urlhaus, spamhausDbl] = await Promise.all([checkUrlhaus(hostname), checkSpamhausDbl(hostname)]);

  const sources = [urlhaus, spamhausDbl];
  const status = sources.some((s) => s.listed) ? "listed" : "clean";

  return { hostname, sources, status };
}
