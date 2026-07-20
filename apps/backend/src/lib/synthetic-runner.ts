import { chromium } from "playwright";
import type { SyntheticStep, SyntheticCheckResult, SyntheticStepResult } from "@watchdog/shared-types";
import { assertSsrfSafe } from "./ssrf-guard";

const DEFAULT_STEP_TIMEOUT_MS = 10_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 60_000;

export interface SyntheticRunOptions {
  stepTimeoutMs?: number;
  totalTimeoutMs?: number;
}

export async function runSyntheticCheck(
  steps: SyntheticStep[],
  opts: SyntheticRunOptions = {}
): Promise<SyntheticCheckResult> {
  const stepTimeoutMs = opts.stepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
  const totalTimeoutMs = opts.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;
  const start = Date.now();
  const results: SyntheticStepResult[] = [];
  let lastStatusCode: number | undefined;

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on("response", (response) => {
      if (response.request().resourceType() === "document") {
        lastStatusCode = response.status();
      }
    });

    for (const step of steps) {
      if (Date.now() - start > totalTimeoutMs) {
        results.push({ action: step.action, ok: false, durationMs: 0, error: "Overall timeout exceeded" });
        return { success: false, steps: results, totalDurationMs: Date.now() - start, error: "Overall timeout exceeded" };
      }

      const stepStart = Date.now();
      try {
        switch (step.action) {
          case "navigate":
            await assertSsrfSafe(step.url);
            await page.goto(step.url, { timeout: stepTimeoutMs, waitUntil: "load" });
            break;
          case "fill":
            await page.fill(step.selector, step.value, { timeout: stepTimeoutMs });
            break;
          case "click":
            await page.click(step.selector, { timeout: stepTimeoutMs });
            break;
          case "assert_text": {
            await page.waitForSelector(step.selector, { timeout: stepTimeoutMs });
            const text = await page.locator(step.selector).first().textContent();
            if (!text?.includes(step.text)) {
              throw new Error(`Expected "${step.text}" in ${step.selector}, got "${text ?? ""}"`);
            }
            break;
          }
          case "assert_status":
            if (lastStatusCode !== step.expected) {
              throw new Error(`Expected status ${step.expected}, got ${lastStatusCode ?? "none"}`);
            }
            break;
        }
        results.push({ action: step.action, ok: true, durationMs: Date.now() - stepStart, statusCode: lastStatusCode });
      } catch (err) {
        results.push({
          action: step.action,
          ok: false,
          durationMs: Date.now() - stepStart,
          error: err instanceof Error ? err.message : String(err),
          statusCode: lastStatusCode,
        });
        return {
          success: false,
          steps: results,
          totalDurationMs: Date.now() - start,
          error: `Step ${results.length} (${step.action}) failed`,
        };
      }
    }

    return { success: true, steps: results, totalDurationMs: Date.now() - start };
  } catch (err) {
    return { success: false, steps: results, totalDurationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await browser?.close();
  }
}
