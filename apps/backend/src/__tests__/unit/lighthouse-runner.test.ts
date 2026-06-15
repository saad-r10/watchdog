import { promisify } from "util";

const mockExecFileAsync = jest.fn();

jest.mock("child_process", () => {
  const execFile: any = () => {
    throw new Error("execFile should be called via promisify");
  };
  execFile[promisify.custom] = (...args: unknown[]) => mockExecFileAsync(...args);
  return { execFile };
});

jest.mock("playwright", () => ({
  chromium: { executablePath: jest.fn().mockReturnValue("/fake/chromium") },
}));

import { runLighthouseCheck } from "../../lib/lighthouse-runner";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("runLighthouseCheck", () => {
  it("parses category scores from the Lighthouse JSON report", async () => {
    const report = {
      categories: {
        performance: { score: 0.93 },
        accessibility: { score: 0.87 },
        "best-practices": { score: 1 },
        seo: { score: 0.75 },
      },
    };
    mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(report), stderr: "" });

    const result = await runLighthouseCheck("https://example.com");

    expect(result).toEqual({
      success: true,
      performance: 93,
      accessibility: 87,
      bestPractices: 100,
      seo: 75,
    });
  });

  it("treats missing categories as null scores", async () => {
    const report = { categories: { performance: { score: 0.5 } } };
    mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify(report), stderr: "" });

    const result = await runLighthouseCheck("https://example.com");

    expect(result).toEqual({
      success: true,
      performance: 50,
      accessibility: null,
      bestPractices: null,
      seo: null,
    });
  });

  it("returns success:false with an error message when the audit fails", async () => {
    mockExecFileAsync.mockRejectedValue(new Error("Chrome could not be started"));

    const result = await runLighthouseCheck("https://example.com");

    expect(result.success).toBe(false);
    expect(result.performance).toBeNull();
    expect(result.accessibility).toBeNull();
    expect(result.bestPractices).toBeNull();
    expect(result.seo).toBeNull();
    expect(result.error).toContain("Chrome could not be started");
  });

  it("returns success:false when the output is not valid JSON", async () => {
    mockExecFileAsync.mockResolvedValue({ stdout: "not json", stderr: "" });

    const result = await runLighthouseCheck("https://example.com");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
