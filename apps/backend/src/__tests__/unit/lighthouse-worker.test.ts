import { runLighthouseCheck } from "../../lib/lighthouse-runner";
import { lighthouseMonitoringEnabled } from "../../lib/feature-flags";
import { monitorRepository } from "../../repositories/monitor.repository";
import { checkRepository } from "../../repositories/check.repository";
import { monitorStatusService } from "../../services/monitor-status.service";
import type { LighthouseResult } from "@watchdog/shared-types";

jest.mock("../../lib/lighthouse-runner");
jest.mock("../../lib/feature-flags");
jest.mock("node-cron", () => ({ schedule: jest.fn() }));
jest.mock("../../repositories/monitor.repository");
jest.mock("../../repositories/check.repository");
jest.mock("../../services/monitor-status.service");

const mockRunLighthouseCheck = runLighthouseCheck as jest.MockedFunction<typeof runLighthouseCheck>;
const mockLighthouseMonitoringEnabled = lighthouseMonitoringEnabled as jest.MockedFunction<typeof lighthouseMonitoringEnabled>;
const mockMonitorRepo = monitorRepository as jest.Mocked<typeof monitorRepository>;
const mockCheckRepo = checkRepository as jest.Mocked<typeof checkRepository>;
const mockMonitorStatusService = monitorStatusService as jest.Mocked<typeof monitorStatusService>;

function makeMonitor(id: string) {
  return {
    id,
    userId: "user-1",
    name: `Monitor ${id}`,
    url: "https://example.com",
    intervalMinutes: 5,
    isActive: true,
    paused: false,
    type: "http" as const,
    syntheticSteps: null,
    contentChangeEnabled: false,
    contentChangeSnoozeUntil: null,
    regionDownThreshold: 1,
    lighthouseEnabled: true,
    lighthousePerformanceBudget: 80,
    lighthouseAccessibilityBudget: 80,
    lighthouseBestPracticesBudget: 80,
    lighthouseSeoBudget: 80,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const successResult: LighthouseResult = {
  success: true,
  performance: 95,
  accessibility: 90,
  bestPractices: 100,
  seo: 85,
};

const failureResult: LighthouseResult = {
  success: false,
  performance: null,
  accessibility: null,
  bestPractices: null,
  seo: null,
  error: "Chrome could not be started",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLighthouseMonitoringEnabled.mockReturnValue(true);
  mockCheckRepo.create.mockResolvedValue({} as any);
  mockMonitorStatusService.evaluateLighthouseStatus.mockResolvedValue(undefined);
});

async function runCronTick() {
  const cron = await import("node-cron");
  const { startLighthouseWorker } = await import("../../workers/lighthouse.worker");
  startLighthouseWorker();
  const cronCallback = (cron.schedule as jest.Mock).mock.calls.at(-1)[1];
  await cronCallback();
}

describe("lighthouse worker", () => {
  it("does nothing when the feature flag is disabled", async () => {
    const monitor = makeMonitor("mon-1");
    mockMonitorRepo.findAllLighthouseEnabled.mockResolvedValue([monitor]);
    mockLighthouseMonitoringEnabled.mockReturnValue(false);

    await runCronTick();

    expect(mockMonitorRepo.findAllLighthouseEnabled).not.toHaveBeenCalled();
    expect(mockRunLighthouseCheck).not.toHaveBeenCalled();
  });

  it("records an 'ok' status check and evaluates the result on success", async () => {
    const monitor = makeMonitor("mon-1");
    mockMonitorRepo.findAllLighthouseEnabled.mockResolvedValue([monitor]);
    mockRunLighthouseCheck.mockResolvedValue(successResult);

    await runCronTick();

    expect(mockRunLighthouseCheck).toHaveBeenCalledWith(monitor.url);
    expect(mockCheckRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "lighthouse",
        status: "ok",
        lighthouseResult: successResult,
      })
    );
    expect(mockMonitorStatusService.evaluateLighthouseStatus).toHaveBeenCalledWith(monitor, successResult);
  });

  it("records an 'error' status check when the audit fails", async () => {
    const monitor = makeMonitor("mon-1");
    mockMonitorRepo.findAllLighthouseEnabled.mockResolvedValue([monitor]);
    mockRunLighthouseCheck.mockResolvedValue(failureResult);

    await runCronTick();

    expect(mockCheckRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "lighthouse",
        status: "error",
        lighthouseResult: failureResult,
      })
    );
    expect(mockMonitorStatusService.evaluateLighthouseStatus).toHaveBeenCalledWith(monitor, failureResult);
  });

  it("checks all monitors across multiple concurrency chunks", async () => {
    const monitors = [makeMonitor("mon-1"), makeMonitor("mon-2"), makeMonitor("mon-3")];
    mockMonitorRepo.findAllLighthouseEnabled.mockResolvedValue(monitors);
    mockRunLighthouseCheck.mockResolvedValue(successResult);

    await runCronTick();

    expect(mockRunLighthouseCheck).toHaveBeenCalledTimes(3);
    for (const monitor of monitors) {
      expect(mockMonitorStatusService.evaluateLighthouseStatus).toHaveBeenCalledWith(monitor, successResult);
    }
  });
});
