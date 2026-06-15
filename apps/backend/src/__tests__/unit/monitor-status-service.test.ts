import { checkRepository } from "../../repositories/check.repository";
import { incidentRepository } from "../../repositories/incident.repository";
import { maintenanceRepository } from "../../repositories/maintenance.repository";
import { alertService } from "../../services/alert.service";
import { monitorStatusService } from "../../services/monitor-status.service";
import { MIN_SAMPLE_SIZE } from "../../lib/anomaly-utils";

jest.mock("../../repositories/check.repository");
jest.mock("../../repositories/incident.repository");
jest.mock("../../repositories/maintenance.repository");
jest.mock("../../repositories/monitor-agent.repository");
jest.mock("../../services/alert.service");

const mockCheckRepo = checkRepository as jest.Mocked<typeof checkRepository>;
const mockIncidentRepo = incidentRepository as jest.Mocked<typeof incidentRepository>;
const mockMaintenanceRepo = maintenanceRepository as jest.Mocked<typeof maintenanceRepository>;
const mockAlertService = alertService as jest.Mocked<typeof alertService>;

const monitor = {
  id: "mon-1",
  userId: "user-1",
  name: "My Site",
  url: "https://example.com",
  intervalMinutes: 5,
  isActive: true,
  paused: false,
  type: "http" as const,
  syntheticSteps: null,
  contentChangeEnabled: false,
  contentChangeSnoozeUntil: null,
  regionDownThreshold: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Alternating 90/110ms baseline -> mean 100, stddev 10, threshold 130
const baseline = Array.from({ length: MIN_SAMPLE_SIZE }, (_, i) => (i % 2 === 0 ? 90 : 110));

const incident = {
  id: "inc-1",
  monitorId: "mon-1",
  type: "performance_degraded" as const,
  startedAt: new Date(),
  resolvedAt: null,
  isResolved: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockMaintenanceRepo.isActive.mockResolvedValue(false);
  mockAlertService.notifyPerformanceDegraded.mockResolvedValue(undefined);
  mockAlertService.notifyPerformanceRecovery.mockResolvedValue(undefined);
});

describe("monitorStatusService.evaluatePerformanceStatus", () => {
  it("does nothing when there aren't enough samples yet", async () => {
    mockCheckRepo.getRecentResponseTimes.mockResolvedValue(baseline.slice(0, MIN_SAMPLE_SIZE));

    await monitorStatusService.evaluatePerformanceStatus(monitor);

    expect(mockIncidentRepo.findOpenPerformanceIncident).not.toHaveBeenCalled();
  });

  it("opens a performance_degraded incident when the latest check is an outlier", async () => {
    mockCheckRepo.getRecentResponseTimes.mockResolvedValue([...baseline, 950]);
    mockIncidentRepo.findOpenPerformanceIncident.mockResolvedValue(null);
    mockIncidentRepo.create.mockResolvedValue(incident);

    await monitorStatusService.evaluatePerformanceStatus(monitor);

    expect(mockIncidentRepo.create).toHaveBeenCalledWith({
      monitor: { connect: { id: monitor.id } },
      type: "performance_degraded",
    });
    expect(mockAlertService.notifyPerformanceDegraded).toHaveBeenCalledWith(
      monitor,
      incident,
      expect.objectContaining({ latest: 950, mean: 100, stddev: 10, threshold: 130 })
    );
  });

  it("does not open a duplicate incident when one is already open", async () => {
    mockCheckRepo.getRecentResponseTimes.mockResolvedValue([...baseline, 950]);
    mockIncidentRepo.findOpenPerformanceIncident.mockResolvedValue(incident);

    await monitorStatusService.evaluatePerformanceStatus(monitor);

    expect(mockIncidentRepo.create).not.toHaveBeenCalled();
    expect(mockAlertService.notifyPerformanceDegraded).not.toHaveBeenCalled();
  });

  it("skips alerting (but still no-ops on incident creation check) during an active maintenance window", async () => {
    mockCheckRepo.getRecentResponseTimes.mockResolvedValue([...baseline, 950]);
    mockIncidentRepo.findOpenPerformanceIncident.mockResolvedValue(null);
    mockIncidentRepo.create.mockResolvedValue(incident);
    mockMaintenanceRepo.isActive.mockResolvedValue(true);

    await monitorStatusService.evaluatePerformanceStatus(monitor);

    expect(mockIncidentRepo.create).toHaveBeenCalled();
    expect(mockAlertService.notifyPerformanceDegraded).not.toHaveBeenCalled();
  });

  it("resolves an open incident and sends a recovery alert once response times are back to normal", async () => {
    mockCheckRepo.getRecentResponseTimes.mockResolvedValue([...baseline, 105]);
    mockIncidentRepo.findOpenPerformanceIncident.mockResolvedValue(incident);
    const resolved = { ...incident, isResolved: true, resolvedAt: new Date() };
    mockIncidentRepo.resolve.mockResolvedValue(resolved);

    await monitorStatusService.evaluatePerformanceStatus(monitor);

    expect(mockIncidentRepo.resolve).toHaveBeenCalledWith(incident.id);
    expect(mockAlertService.notifyPerformanceRecovery).toHaveBeenCalledWith(monitor, resolved);
  });
});
