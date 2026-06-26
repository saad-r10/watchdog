import axios from "axios";

const REQUEST_TIMEOUT = 8_000;

// Short, curated list to avoid noisy false positives - common accidental-exposure paths only.
export const EXPOSED_PATHS = [
  "/.env",
  "/.git/config",
  "/.git/HEAD",
  "/.DS_Store",
  "/wp-admin/",
  "/.aws/credentials",
];

export interface SecurityTxtFinding {
  present: boolean;
  issue: string | null;
}

export interface ExposedPathFinding {
  path: string;
  exposed: boolean;
  statusCode: number | null;
}

export interface ExposureFindings {
  securityTxt: SecurityTxtFinding;
  exposedPaths: ExposedPathFinding[];
}

export interface ExposureAnalysisResult extends ExposureFindings {
  status: "pass" | "fail";
}

async function fetchPath(baseUrl: string, path: string): Promise<{ status: number | null; length: number }> {
  try {
    const res = await axios.get(new URL(path, baseUrl).toString(), {
      timeout: REQUEST_TIMEOUT,
      validateStatus: () => true,
      maxRedirects: 0,
      headers: { "User-Agent": "Watchdog-ExposureCheck/1.0" },
    });
    const length = typeof res.data === "string" ? res.data.length : JSON.stringify(res.data ?? "").length;
    return { status: res.status, length };
  } catch {
    return { status: null, length: 0 };
  }
}

export async function checkSecurityTxt(baseUrl: string): Promise<SecurityTxtFinding> {
  const res = await fetchPath(baseUrl, "/.well-known/security.txt");
  if (res.status === 200) return { present: true, issue: null };
  return { present: false, issue: "No /.well-known/security.txt found (RFC 9116)" };
}

export async function checkExposedPaths(baseUrl: string): Promise<ExposedPathFinding[]> {
  // Probe a path that can't exist - sites with a SPA catch-all return 200 for everything,
  // so any real path that matches this baseline isn't actually an exposure.
  const baseline = await fetchPath(baseUrl, `/__watchdog-exposure-probe-${Date.now()}__`);

  return Promise.all(
    EXPOSED_PATHS.map(async (path) => {
      const res = await fetchPath(baseUrl, path);
      const matchesCatchAll = res.status === baseline.status && Math.abs(res.length - baseline.length) < 32;
      const exposed = res.status === 200 && !matchesCatchAll;
      return { path, exposed, statusCode: res.status };
    })
  );
}

export async function analyseExposure(baseUrl: string): Promise<ExposureAnalysisResult> {
  const [securityTxt, exposedPaths] = await Promise.all([
    checkSecurityTxt(baseUrl),
    checkExposedPaths(baseUrl),
  ]);

  // Missing security.txt is informational only - it doesn't fail the check on its own.
  const hasExposedPath = exposedPaths.some((p) => p.exposed);

  return { securityTxt, exposedPaths, status: hasExposedPath ? "fail" : "pass" };
}
