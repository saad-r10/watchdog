import { execFile } from "child_process";
import { promisify } from "util";
import { chromium } from "playwright";
import type { LighthouseResult } from "@watchdog/shared-types";
import { assertSsrfSafe } from "./ssrf-guard";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 120_000;

export async function runLighthouseCheck(url: string): Promise<LighthouseResult> {
  try {
    await assertSsrfSafe(url);
    const { stdout } = await execFileAsync("npx", [
      "--no-install", "lighthouse", url,
      "--output=json", "--output-path=stdout", "--quiet",
      "--only-categories=performance,accessibility,best-practices,seo",
      "--chrome-flags=--headless=new --no-sandbox --disable-gpu",
    ], {
      env: { ...process.env, CHROME_PATH: chromium.executablePath() },
      timeout: TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
    });

    const report = JSON.parse(stdout);
    const categories = report.categories ?? {};
    const score = (cat: { score?: number | null } | undefined) =>
      cat?.score == null ? null : Math.round(cat.score * 100);

    return {
      success: true,
      performance: score(categories.performance),
      accessibility: score(categories.accessibility),
      bestPractices: score(categories["best-practices"]),
      seo: score(categories.seo),
    };
  } catch (err) {
    return {
      success: false,
      performance: null,
      accessibility: null,
      bestPractices: null,
      seo: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
