import { timedRequest, type TimedResponse } from "../../lib/timed-request";
import { checkRepository } from "../../repositories/check.repository";
import { incidentRepository } from "../../repositories/incident.repository";
import { maintenanceRepository } from "../../repositories/maintenance.repository";
import { alertService } from "../../services/alert.service";
import { monitorRepository } from "../../repositories/monitor.repository";

jest.mock("../../lib/timed-request");
jest.mock("node-cron", () => ({ schedule: jest.fn() }));
jest.mock("../../repositories/check.repository");
jest.mock("../../repositories/incident.repository");
jest.mock("../../repositories/maintenance.repository");
jest.mock("../../repositories/monitor.repository");
jest.mock("../../services/alert.service");

const mockTimedRequest = timedRequest as jest.MockedFunction<typeof timedRequest>;
const mockCheckRepo = checkRepository as jest.Mocked<typeof checkRepository>;
const mockIncidentRepo = incidentRepository as jest.Mocked<typeof incidentRepository>;
const mockMaintenanceRepo = maintenanceRepository as jest.Mocked<typeof maintenanceRepository>;
const mockAlertService = alertService as jest.Mocked<typeof alertService>;
const mockMonitorRepo = monitorRepository as jest.Mocked<typeof monitorRepository>;

function makeResponse(overrides: Partial<TimedResponse> = {}): TimedResponse {
  return {
    ok: true,
    statusCode: 200,
    timings: {
      dnsMs: 5,
      tcpMs: 12,
      tlsMs: 30,
      ttfbMs: 42,
      downloadMs: 8,
      totalMs: 97,
      sizeBytes: 1234,
    },
    ...overrides,
  };
}

const monitor = {
  id: "mon-1",
  userId: "user-1",
  name: "Test",
  url: "https://example.com",
  agentId: null,
  intervalMinutes: 1,
  isActive: true,
  paused: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const incident = {
  id: "inc-1",
  monitorId: "mon-1",
  type: "downtime" as const,
  startedAt: new Date(),
  resolvedAt: null,
  isResolved: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckRepo.create.mockResolvedValue({} as any);
  mockIncidentRepo.create.mockResolvedValue(incident);
  mockIncidentRepo.resolve.mockResolvedValue({ ...incident, isResolved: true });
  mockMaintenanceRepo.isActive.mockResolvedValue(false);
  mockAlertService.notifyDowntime.mockResolvedValue(undefined);
});

async function runCronTick() {
  const cron = await import("node-cron");
  const { startUptimeWorker } = await import("../../workers/uptime.worker");
  startUptimeWorker();
  const cronCallback = (cron.schedule as jest.Mock).mock.calls.at(-1)[1];
  await cronCallback();
}

describe("uptime worker — downtime detection", () => {
  it("creates a down check when site returns 500", async () => {
    mockTimedRequest.mockResolvedValue(makeResponse({ statusCode: 500 }));
    mockIncidentRepo.findOpenByMonitor.mockResolvedValue(null);
    mockMonitorRepo.findAllActive.mockResolvedValue([monitor]);

    await runCronTick();

    expect(mockCheckRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "down" })
    );
    expect(mockIncidentRepo.create).toHaveBeenCalled();
    expect(mockAlertService.notifyDowntime).toHaveBeenCalledWith(monitor, incident);
  });

  it("creates an up check and resolves open incident on recovery", async () => {
    mockTimedRequest.mockResolvedValue(makeResponse({ statusCode: 200 }));
    mockIncidentRepo.findOpenByMonitor.mockResolvedValue(incident);
    mockMonitorRepo.findAllActive.mockResolvedValue([monitor]);

    await runCronTick();

    expect(mockCheckRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "up" })
    );
    expect(mockIncidentRepo.resolve).toHaveBeenCalledWith("inc-1");
    expect(mockIncidentRepo.create).not.toHaveBeenCalled();
  });

  it("does not create a new incident if one is already open", async () => {
    mockTimedRequest.mockResolvedValue(makeResponse({ statusCode: 503 }));
    mockIncidentRepo.findOpenByMonitor.mockResolvedValue(incident);
    mockMonitorRepo.findAllActive.mockResolvedValue([monitor]);

    await runCronTick();

    expect(mockIncidentRepo.create).not.toHaveBeenCalled();
    expect(mockAlertService.notifyDowntime).not.toHaveBeenCalled();
  });

  it("marks site down on network error (no response received)", async () => {
    mockTimedRequest.mockResolvedValue(
      makeResponse({
        ok: false,
        statusCode: null,
        timings: {
          dnsMs: null,
          tcpMs: null,
          tlsMs: null,
          ttfbMs: null,
          downloadMs: null,
          totalMs: 31,
          sizeBytes: null,
        },
      })
    );
    mockIncidentRepo.findOpenByMonitor.mockResolvedValue(null);
    mockMonitorRepo.findAllActive.mockResolvedValue([monitor]);

    await runCronTick();

    expect(mockCheckRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "down", statusCode: null })
    );
    expect(mockIncidentRepo.create).toHaveBeenCalled();
  });
});

describe("uptime worker — timing breakdown persistence", () => {
  it("persists phase timings and payload size on the check", async () => {
    mockTimedRequest.mockResolvedValue(makeResponse());
    mockIncidentRepo.findOpenByMonitor.mockResolvedValue(null);
    mockMonitorRepo.findAllActive.mockResolvedValue([monitor]);

    await runCronTick();

    expect(mockCheckRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "up",
        statusCode: 200,
        responseTime: 97,
        dnsMs: 5,
        tcpMs: 12,
        tlsMs: 30,
        ttfbMs: 42,
        downloadMs: 8,
        sizeBytes: 1234,
      })
    );
  });
});
