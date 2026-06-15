import { runSyntheticCheck } from "../../lib/synthetic-runner";
import { syntheticMonitoringEnabled } from "../../lib/feature-flags";
import { monitorRepository } from "../../repositories/monitor.repository";
import { checkRepository } from "../../repositories/check.repository";
import { monitorStatusService } from "../../services/monitor-status.service";
import type { SyntheticCheckResult } from "@watchdog/shared-types";

jest.mock("../../lib/synthetic-runner");
jest.mock("../../lib/feature-flags");
jest.mock("node-cron", () => ({ schedule: jest.fn() }));
jest.mock("../../repositories/monitor.repository");
jest.mock("../../repositories/check.repository");
jest.mock("../../services/monitor-status.service");

const mockRunSyntheticCheck = runSyntheticCheck as jest.MockedFunction<typeof runSyntheticCheck>;
const mockSyntheticMonitoringEnabled = syntheticMonitoringEnabled as jest.MockedFunction<typeof syntheticMonitoringEnabled>;
const mockMonitorRepo = monitorRepository as jest.Mocked<typeof monitorRepository>;
const mockCheckRepo = checkRepository as jest.Mocked<typeof checkRepository>;
const mockMonitorStatusService = monitorStatusService as jest.Mocked<typeof monitorStatusService>;

const steps = [
  { action: "navigate" as const, url: "https://example.com/login" },
  { action: "click" as const, selector: "#login-button" },
];

const monitor = {
  id: "mon-1",
  userId: "user-1",
  name: "Login flow",
  url: "https://example.com",
  intervalMinutes: 5,
  isActive: true,
  paused: false,
  type: "synthetic" as const,
  syntheticSteps: steps,
  contentChangeEnabled: false,
  contentChangeSnoozeUntil: null,
  regionDownThreshold: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const successResult: SyntheticCheckResult = {
  success: true,
  steps: [
    { action: "navigate", ok: true, durationMs: 100 },
    { action: "click", ok: true, durationMs: 50 },
  ],
  totalDurationMs: 150,
};

const failureResult: SyntheticCheckResult = {
  success: false,
  steps: [
    { action: "navigate", ok: true, durationMs: 100 },
    { action: "click", ok: false, durationMs: 10_000, error: "Timeout" },
  ],
  totalDurationMs: 10_100,
  error: "Step 2 (click) failed",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSyntheticMonitoringEnabled.mockReturnValue(true);
  mockCheckRepo.create.mockResolvedValue({} as any);
  mockCheckRepo.findLatestByType.mockResolvedValue(null);
  mockMonitorStatusService.evaluateSyntheticStatus.mockResolvedValue(undefined);
});

async function runCronTick() {
  const cron = await import("node-cron");
  const { startSyntheticWorker } = await import("../../workers/synthetic.worker");
  startSyntheticWorker();
  const cronCallback = (cron.schedule as jest.Mock).mock.calls.at(-1)[1];
  await cronCallback();
}

describe("synthetic worker", () => {
  it("does nothing when the feature flag is disabled", async () => {
    mockSyntheticMonitoringEnabled.mockReturnValue(false);
    mockMonitorRepo.findAllSynthetic.mockResolvedValue([monitor]);

    await runCronTick();

    expect(mockMonitorRepo.findAllSynthetic).not.toHaveBeenCalled();
    expect(mockRunSyntheticCheck).not.toHaveBeenCalled();
  });

  it("skips monitors with no synthetic steps", async () => {
    mockMonitorRepo.findAllSynthetic.mockResolvedValue([{ ...monitor, syntheticSteps: [] }]);

    await runCronTick();

    expect(mockRunSyntheticCheck).not.toHaveBeenCalled();
    expect(mockCheckRepo.create).not.toHaveBeenCalled();
  });

  it("skips a monitor if its last synthetic check is within the (clamped) interval", async () => {
    mockMonitorRepo.findAllSynthetic.mockResolvedValue([{ ...monitor, intervalMinutes: 1 }]);
    mockCheckRepo.findLatestByType.mockResolvedValue({ checkedAt: new Date() } as any);

    await runCronTick();

    expect(mockRunSyntheticCheck).not.toHaveBeenCalled();
  });

  it("runs the check and records an 'up' status on success", async () => {
    mockMonitorRepo.findAllSynthetic.mockResolvedValue([monitor]);
    mockRunSyntheticCheck.mockResolvedValue(successResult);

    await runCronTick();

    expect(mockRunSyntheticCheck).toHaveBeenCalledWith(steps);
    expect(mockCheckRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "synthetic",
        status: "up",
        responseTime: 150,
        syntheticResult: successResult,
      })
    );
    expect(mockMonitorStatusService.evaluateSyntheticStatus).toHaveBeenCalledWith(monitor, successResult);
  });

  it("runs the check and records a 'down' status when a step fails", async () => {
    mockMonitorRepo.findAllSynthetic.mockResolvedValue([monitor]);
    mockRunSyntheticCheck.mockResolvedValue(failureResult);

    await runCronTick();

    expect(mockCheckRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "synthetic",
        status: "down",
        responseTime: 10_100,
        syntheticResult: failureResult,
      })
    );
    expect(mockMonitorStatusService.evaluateSyntheticStatus).toHaveBeenCalledWith(monitor, failureResult);
  });
});
