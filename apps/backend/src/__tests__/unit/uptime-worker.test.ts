import axios from "axios";
import { checkRepository } from "../../repositories/check.repository";
import { incidentRepository } from "../../repositories/incident.repository";
import { maintenanceRepository } from "../../repositories/maintenance.repository";
import { alertService } from "../../services/alert.service";
import { monitorRepository } from "../../repositories/monitor.repository";

jest.mock("axios");
jest.mock("node-cron", () => ({ schedule: jest.fn() }));
jest.mock("../../repositories/check.repository");
jest.mock("../../repositories/incident.repository");
jest.mock("../../repositories/maintenance.repository");
jest.mock("../../repositories/monitor.repository");
jest.mock("../../services/alert.service");

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockCheckRepo = checkRepository as jest.Mocked<typeof checkRepository>;
const mockIncidentRepo = incidentRepository as jest.Mocked<typeof incidentRepository>;
const mockMaintenanceRepo = maintenanceRepository as jest.Mocked<typeof maintenanceRepository>;
const mockAlertService = alertService as jest.Mocked<typeof alertService>;
const mockMonitorRepo = monitorRepository as jest.Mocked<typeof monitorRepository>;

const monitor = {
  id: "mon-1",
  userId: "user-1",
  name: "Test",
  url: "https://example.com",
  agentId: null,
  intervalMinutes: 1,
  isActive: true,
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

describe("uptime worker — downtime detection", () => {
  it("creates a down check when site returns 500", async () => {
    mockAxios.get.mockResolvedValue({ status: 500 });
    mockIncidentRepo.findOpenByMonitor.mockResolvedValue(null);

    const { startUptimeWorker } = await import("../../workers/uptime.worker");
    // Drive checkUptime by calling the worker's internal through mocked monitor list
    mockMonitorRepo.findAllActive.mockResolvedValue([monitor]);

    // Since startUptimeWorker schedules with node-cron (mocked), we need to
    // invoke checkUptime directly by importing and calling a one-shot helper.
    // Re-import is necessary because jest.mock is module-level.
    // We test the logic by verifying repository calls after triggering a cron tick.

    // Trigger the worker which calls cron.schedule — node-cron is mocked,
    // so we grab the callback and call it manually.
    const cron = await import("node-cron");
    startUptimeWorker();
    const scheduleCall = (cron.schedule as jest.Mock).mock.calls[0];
    const cronCallback = scheduleCall[1];
    await cronCallback();

    expect(mockCheckRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "down" })
    );
    expect(mockIncidentRepo.create).toHaveBeenCalled();
    expect(mockAlertService.notifyDowntime).toHaveBeenCalledWith(monitor, incident);
  });

  it("creates an up check and resolves open incident on recovery", async () => {
    mockAxios.get.mockResolvedValue({ status: 200 });
    mockIncidentRepo.findOpenByMonitor.mockResolvedValue(incident);
    mockMonitorRepo.findAllActive.mockResolvedValue([monitor]);

    const cron = await import("node-cron");
    const { startUptimeWorker } = await import("../../workers/uptime.worker");
    startUptimeWorker();
    const cronCallback = (cron.schedule as jest.Mock).mock.calls.at(-1)[1];
    await cronCallback();

    expect(mockCheckRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "up" })
    );
    expect(mockIncidentRepo.resolve).toHaveBeenCalledWith("inc-1");
    expect(mockIncidentRepo.create).not.toHaveBeenCalled();
  });

  it("does not create a new incident if one is already open", async () => {
    mockAxios.get.mockResolvedValue({ status: 503 });
    mockIncidentRepo.findOpenByMonitor.mockResolvedValue(incident);
    mockMonitorRepo.findAllActive.mockResolvedValue([monitor]);

    const cron = await import("node-cron");
    const { startUptimeWorker } = await import("../../workers/uptime.worker");
    startUptimeWorker();
    const cronCallback = (cron.schedule as jest.Mock).mock.calls.at(-1)[1];
    await cronCallback();

    expect(mockIncidentRepo.create).not.toHaveBeenCalled();
    expect(mockAlertService.notifyDowntime).not.toHaveBeenCalled();
  });

  it("marks site down when axios throws (network error)", async () => {
    mockAxios.get.mockRejectedValue(new Error("ECONNREFUSED"));
    mockIncidentRepo.findOpenByMonitor.mockResolvedValue(null);
    mockMonitorRepo.findAllActive.mockResolvedValue([monitor]);

    const cron = await import("node-cron");
    const { startUptimeWorker } = await import("../../workers/uptime.worker");
    startUptimeWorker();
    const cronCallback = (cron.schedule as jest.Mock).mock.calls.at(-1)[1];
    await cronCallback();

    expect(mockCheckRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "down" })
    );
    expect(mockIncidentRepo.create).toHaveBeenCalled();
  });
});
