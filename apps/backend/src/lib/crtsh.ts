import axios from "axios";

export interface CrtShEntry {
  id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  not_before: string;
  not_after: string;
}

/**
 * Queries crt.sh's Certificate Transparency log search for all certificates
 * covering the given hostname or its subdomains. Returns one entry per
 * distinct certificate, deduplicated by crt.sh's certificate id (crt.sh
 * returns one row per matching SAN, so a single cert can appear multiple times).
 */
export async function fetchCertTransparencyEntries(hostname: string): Promise<CrtShEntry[]> {
  const res = await axios.get(`https://crt.sh/?q=${encodeURIComponent(`%.${hostname}`)}&output=json`, {
    timeout: 20_000,
    headers: { "User-Agent": "Watchdog-CT-Worker/1.0" },
  });

  const data = res.data;
  if (!Array.isArray(data)) return [];

  const byId = new Map<number, CrtShEntry>();
  for (const entry of data) {
    if (entry && typeof entry.id === "number" && !byId.has(entry.id)) {
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()];
}
