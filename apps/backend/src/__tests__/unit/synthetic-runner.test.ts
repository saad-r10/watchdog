import { chromium } from "playwright";
import { runSyntheticCheck } from "../../lib/synthetic-runner";
import type { SyntheticStep } from "@watchdog/shared-types";

jest.mock("playwright", () => ({
  chromium: { launch: jest.fn() },
}));

const mockLaunch = chromium.launch as jest.Mock;

function makePage() {
  const handlers: Record<string, (...args: any[]) => void> = {};
  const page: any = {
    on: jest.fn((event: string, cb: (...args: any[]) => void) => {
      handlers[event] = cb;
    }),
    goto: jest.fn().mockImplementation(async () => {
      handlers.response?.({ request: () => ({ resourceType: () => "document" }), status: () => 200 });
    }),
    fill: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(undefined),
    locator: jest.fn().mockReturnValue({
      first: () => ({ textContent: jest.fn().mockResolvedValue("Welcome to Dashboard") }),
    }),
  };
  return page;
}

function makeBrowser(page: any) {
  return {
    newPage: jest.fn().mockResolvedValue(page),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("runSyntheticCheck", () => {
  it("runs all steps and reports success", async () => {
    const page = makePage();
    const browser = makeBrowser(page);
    mockLaunch.mockResolvedValue(browser);

    const steps: SyntheticStep[] = [
      { action: "navigate", url: "https://example.com/login" },
      { action: "fill", selector: "#username", value: "demo@example.com" },
      { action: "click", selector: "#login-button" },
      { action: "assert_text", selector: "h1", text: "Dashboard" },
      { action: "assert_status", expected: 200 },
    ];

    const result = await runSyntheticCheck(steps);

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(5);
    expect(result.steps.every((s) => s.ok)).toBe(true);
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("short-circuits on the first failing step", async () => {
    const page = makePage();
    page.click.mockRejectedValue(new Error("Timeout waiting for selector #login-button"));
    const browser = makeBrowser(page);
    mockLaunch.mockResolvedValue(browser);

    const steps: SyntheticStep[] = [
      { action: "navigate", url: "https://example.com/login" },
      { action: "fill", selector: "#username", value: "demo@example.com" },
      { action: "click", selector: "#login-button" },
      { action: "assert_text", selector: "h1", text: "Dashboard" },
    ];

    const result = await runSyntheticCheck(steps);

    expect(result.success).toBe(false);
    expect(result.steps).toHaveLength(3);
    expect(result.steps[2]).toEqual(
      expect.objectContaining({ action: "click", ok: false, error: "Timeout waiting for selector #login-button" })
    );
    expect(result.error).toBe("Step 3 (click) failed");
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("aborts with an overall timeout error when the total duration is exceeded", async () => {
    const page = makePage();
    const browser = makeBrowser(page);
    mockLaunch.mockResolvedValue(browser);

    const dateSpy = jest.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(1000);

    const steps: SyntheticStep[] = [
      { action: "navigate", url: "https://example.com/login" },
      { action: "click", selector: "#login-button" },
    ];

    const result = await runSyntheticCheck(steps, { totalTimeoutMs: 100 });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Overall timeout exceeded");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toEqual(expect.objectContaining({ action: "navigate", ok: false, error: "Overall timeout exceeded" }));
    expect(browser.close).toHaveBeenCalledTimes(1);

    dateSpy.mockRestore();
  });

  it("closes the browser even if a step throws an unexpected error", async () => {
    const page = makePage();
    page.goto.mockRejectedValue(new Error("net::ERR_NAME_NOT_RESOLVED"));
    const browser = makeBrowser(page);
    mockLaunch.mockResolvedValue(browser);

    const steps: SyntheticStep[] = [{ action: "navigate", url: "https://does-not-exist.example" }];

    const result = await runSyntheticCheck(steps);

    expect(result.success).toBe(false);
    expect(result.steps[0]).toEqual(expect.objectContaining({ ok: false, error: "net::ERR_NAME_NOT_RESOLVED" }));
    expect(browser.close).toHaveBeenCalledTimes(1);
  });
});
