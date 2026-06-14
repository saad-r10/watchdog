import { promises as dns } from "dns";

export interface SpfFinding {
  present: boolean;
  record: string | null;
  issue: string | null;
}

export interface DmarcFinding {
  present: boolean;
  record: string | null;
  policy: string | null;
  issue: string | null;
}

export interface DkimFinding {
  present: boolean;
  selectors: string[];
  issue: string | null;
}

export interface DanglingCnameFinding {
  present: boolean;
  target: string | null;
  dangling: boolean;
  issue: string | null;
}

export interface DnsFindings {
  spf: SpfFinding;
  dmarc: DmarcFinding;
  dkim: DkimFinding;
  danglingCname: DanglingCnameFinding;
}

export interface DnsAnalysisResult extends DnsFindings {
  status: "pass" | "fail";
}

// No selector-discovery mechanism exists in DNS, so DKIM presence is checked
// against the selectors most commonly published by mail providers.
const DKIM_SELECTORS = ["default", "google", "selector1", "selector2", "k1", "mail", "dkim", "smtp"];

async function lookupTxt(hostname: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(hostname);
    return records.map((r) => r.join(""));
  } catch {
    return [];
  }
}

export async function checkSpf(hostname: string): Promise<SpfFinding> {
  const records = await lookupTxt(hostname);
  const spf = records.find((r) => r.startsWith("v=spf1"));
  if (!spf) return { present: false, record: null, issue: "No SPF record found" };
  return { present: true, record: spf, issue: null };
}

export async function checkDmarc(hostname: string): Promise<DmarcFinding> {
  const records = await lookupTxt(`_dmarc.${hostname}`);
  const dmarc = records.find((r) => r.startsWith("v=DMARC1"));
  if (!dmarc) return { present: false, record: null, policy: null, issue: "No DMARC record found" };

  const policyMatch = dmarc.match(/p=([^;]+)/);
  const policy = policyMatch ? policyMatch[1].trim() : null;
  const issue =
    policy === "none"
      ? "DMARC policy is 'none' — spoofed mail is reported but not rejected or quarantined"
      : policy === null
        ? "DMARC record is missing a policy (p=) tag"
        : null;

  return { present: true, record: dmarc, policy, issue };
}

export async function checkDkim(hostname: string): Promise<DkimFinding> {
  const found: string[] = [];
  for (const selector of DKIM_SELECTORS) {
    const records = await lookupTxt(`${selector}._domainkey.${hostname}`);
    if (records.some((r) => r.includes("v=DKIM1") || r.includes("p="))) {
      found.push(selector);
    }
  }
  if (found.length === 0) {
    return { present: false, selectors: [], issue: "No DKIM record found for common selectors" };
  }
  return { present: true, selectors: found, issue: null };
}

export async function checkDanglingCname(hostname: string): Promise<DanglingCnameFinding> {
  let target: string | null = null;
  try {
    const records = await dns.resolveCname(hostname);
    target = records[0] ?? null;
  } catch {
    return { present: false, target: null, dangling: false, issue: null };
  }
  if (!target) return { present: false, target: null, dangling: false, issue: null };

  try {
    await dns.resolve4(target);
    return { present: true, target, dangling: false, issue: null };
  } catch {
    try {
      await dns.resolve6(target);
      return { present: true, target, dangling: false, issue: null };
    } catch {
      return {
        present: true,
        target,
        dangling: true,
        issue: `CNAME points to "${target}", which does not resolve — possible subdomain takeover risk`,
      };
    }
  }
}

export async function analyseDns(hostname: string): Promise<DnsAnalysisResult> {
  const [spf, dmarc, dkim, danglingCname] = await Promise.all([
    checkSpf(hostname),
    checkDmarc(hostname),
    checkDkim(hostname),
    checkDanglingCname(hostname),
  ]);

  // DKIM is excluded from the pass/fail verdict — the selector-guessing heuristic
  // above is too unreliable to flag as a finding on its own.
  const hasIssue = !!spf.issue || !!dmarc.issue || danglingCname.dangling;

  return { spf, dmarc, dkim, danglingCname, status: hasIssue ? "fail" : "pass" };
}
