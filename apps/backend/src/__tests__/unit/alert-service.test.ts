import { alertRepository } from "../../repositories/alert.repository";
import { sendEmail } from "../../services/email.service";
import { alertService } from "../../services/alert.service";
import { prisma } from "../../db";

jest.mock("../../repositories/alert.repository");
jest.mock("../../services/email.service");
jest.mock("../../db", () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

const mockAlertRepo = alertRepository as jest.Mocked<typeof alertRepository>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

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
  mockSendEmail.mockResolvedValue(undefined);
  mockAlertRepo.create.mockResolvedValue(undefined);
});

describe("alertService.notifyDowntime", () => {
  it("sends email when no prior alert exists and alertDowntime is enabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertDowntime: true,
    });

    await alertService.notifyDowntime(monitor, incident);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com", subject: expect.stringContaining("Down") })
    );
    expect(mockAlertRepo.create).toHaveBeenCalledWith({
      userId: "user-1",
      incidentId: "inc-1",
      type: "downtime",
    });
  });

  it("uses custom alertEmail when set", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: "alerts@custom.com",
      alertDowntime: true,
    });

    await alertService.notifyDowntime(monitor, incident);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "alerts@custom.com" })
    );
  });

  it("skips sending when cooldown is active (alert already sent)", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(true);

    await alertService.notifyDowntime(monitor, incident);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAlertRepo.create).not.toHaveBeenCalled();
  });

  it("skips sending when user has alertDowntime disabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertDowntime: false,
    });

    await alertService.notifyDowntime(monitor, incident);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("alertService.notifySslExpiry", () => {
  const sslIncident = { ...incident, type: "ssl_expiry" as const };

  it("sends SSL expiry email when no prior alert and alertSslExpiry is enabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertSslExpiry: true,
    });

    await alertService.notifySslExpiry(monitor, sslIncident, 10);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("10 days") })
    );
  });

  it("skips when alertSslExpiry is disabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertSslExpiry: false,
    });

    await alertService.notifySslExpiry(monitor, sslIncident, 5);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("alertService.notifyUnexpectedCert", () => {
  const ctIncident = { ...incident, type: "unexpected_cert" as const, isResolved: true, resolvedAt: new Date() };
  const newCerts = [
    {
      id: 999,
      issuer_name: "C=US, O=Let's Encrypt, CN=R3",
      common_name: "evil.example.com",
      name_value: "evil.example.com",
      not_before: "2026-06-01T00:00:00",
      not_after: "2026-09-01T00:00:00",
    },
  ];

  it("sends a new-certificate email when no prior alert and alertCertTransparency is enabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertCertTransparency: true,
      webhookUrl: null,
    });

    await alertService.notifyUnexpectedCert(monitor, ctIncident, newCerts);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("New certificate detected") })
    );
    expect(mockAlertRepo.create).toHaveBeenCalledWith({ userId: "user-1", incidentId: "inc-1" });
  });

  it("skips when alertCertTransparency is disabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertCertTransparency: false,
      webhookUrl: null,
    });

    await alertService.notifyUnexpectedCert(monitor, ctIncident, newCerts);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips sending when cooldown is active (alert already sent)", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(true);

    await alertService.notifyUnexpectedCert(monitor, ctIncident, newCerts);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAlertRepo.create).not.toHaveBeenCalled();
  });
});

describe("alertService.notifyDomainBlocklisted", () => {
  const blocklistIncident = { ...incident, type: "domain_blocklisted" as const };
  const findings = {
    hostname: "example.com",
    sources: [
      { source: "urlhaus" as const, listed: true, detail: "Hostname appears in the URLhaus malware/phishing host blocklist" },
      { source: "spamhaus_dbl" as const, listed: false, detail: null },
    ],
  };

  it("sends a domain-blocklisted email when no prior alert and alertBlocklist is enabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertBlocklist: true,
      webhookUrl: null,
    });

    await alertService.notifyDomainBlocklisted(monitor, blocklistIncident, findings);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("Domain blocklisted") })
    );
    expect(mockAlertRepo.create).toHaveBeenCalledWith({ userId: "user-1", incidentId: "inc-1" });
  });

  it("skips when alertBlocklist is disabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertBlocklist: false,
      webhookUrl: null,
    });

    await alertService.notifyDomainBlocklisted(monitor, blocklistIncident, findings);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips sending when cooldown is active (alert already sent)", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(true);

    await alertService.notifyDomainBlocklisted(monitor, blocklistIncident, findings);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAlertRepo.create).not.toHaveBeenCalled();
  });
});

describe("alertService.notifySyntheticFailure", () => {
  const syntheticIncident = { ...incident, type: "synthetic_failure" as const };
  const failureResult = {
    success: false,
    steps: [
      { action: "navigate" as const, ok: true, durationMs: 120 },
      { action: "fill" as const, ok: true, durationMs: 30 },
      { action: "click" as const, ok: false, durationMs: 10_000, error: "Timeout waiting for selector #login-button" },
    ],
    totalDurationMs: 10_150,
    error: "Step 3 (click) failed",
  };

  it("sends a transaction-failed email when no prior alert and alertSyntheticFailure is enabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertSyntheticFailure: true,
      webhookUrl: null,
    });

    await alertService.notifySyntheticFailure(monitor, syntheticIncident, failureResult);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("Transaction failed") })
    );
    expect(mockAlertRepo.create).toHaveBeenCalledWith({ userId: "user-1", incidentId: "inc-1", type: "downtime" });
  });

  it("skips when alertSyntheticFailure is disabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertSyntheticFailure: false,
      webhookUrl: null,
    });

    await alertService.notifySyntheticFailure(monitor, syntheticIncident, failureResult);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips sending when cooldown is active (alert already sent)", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(true);

    await alertService.notifySyntheticFailure(monitor, syntheticIncident, failureResult);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAlertRepo.create).not.toHaveBeenCalled();
  });
});

describe("alertService.notifySyntheticRecovery", () => {
  const recoveryIncident = { ...incident, type: "synthetic_failure" as const, isResolved: true, resolvedAt: new Date() };

  it("sends a transaction-recovered email when no prior recovery alert and alertSyntheticFailure is enabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertSyntheticFailure: true,
      webhookUrl: null,
    });

    await alertService.notifySyntheticRecovery(monitor, recoveryIncident);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("Transaction recovered") })
    );
    expect(mockAlertRepo.create).toHaveBeenCalledWith({ userId: "user-1", incidentId: "inc-1", type: "recovery" });
  });

  it("skips when alertSyntheticFailure is disabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertSyntheticFailure: false,
      webhookUrl: null,
    });

    await alertService.notifySyntheticRecovery(monitor, recoveryIncident);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips sending when cooldown is active (recovery alert already sent)", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(true);

    await alertService.notifySyntheticRecovery(monitor, recoveryIncident);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAlertRepo.create).not.toHaveBeenCalled();
  });
});

describe("alertService.notifyContentChanged", () => {
  const contentChangeIncident = { ...incident, type: "content_changed" as const, isResolved: true, resolvedAt: new Date() };

  it("sends a content-change email when no prior alert and alertContentChange is enabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertContentChange: true,
      webhookUrl: null,
    });

    await alertService.notifyContentChanged(monitor, contentChangeIncident);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("Content changed") })
    );
    expect(mockAlertRepo.create).toHaveBeenCalledWith({ userId: "user-1", incidentId: "inc-1" });
  });

  it("skips when alertContentChange is disabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertContentChange: false,
      webhookUrl: null,
    });

    await alertService.notifyContentChanged(monitor, contentChangeIncident);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips sending when cooldown is active (alert already sent)", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(true);

    await alertService.notifyContentChanged(monitor, contentChangeIncident);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAlertRepo.create).not.toHaveBeenCalled();
  });
});

describe("alertService.notifyPerformanceDegraded", () => {
  const performanceIncident = { ...incident, type: "performance_degraded" as const };
  const stats = { latest: 950, mean: 200, stddev: 50, threshold: 350 };

  it("sends a slow-response email when no prior alert and alertPerformanceDegraded is enabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertPerformanceDegraded: true,
      webhookUrl: null,
    });

    await alertService.notifyPerformanceDegraded(monitor, performanceIncident, stats);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("Slow response times") })
    );
    expect(mockAlertRepo.create).toHaveBeenCalledWith({ userId: "user-1", incidentId: "inc-1" });
  });

  it("skips when alertPerformanceDegraded is disabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertPerformanceDegraded: false,
      webhookUrl: null,
    });

    await alertService.notifyPerformanceDegraded(monitor, performanceIncident, stats);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips sending when cooldown is active (alert already sent)", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(true);

    await alertService.notifyPerformanceDegraded(monitor, performanceIncident, stats);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAlertRepo.create).not.toHaveBeenCalled();
  });
});

describe("alertService.notifyPerformanceRecovery", () => {
  const recoveryIncident = { ...incident, type: "performance_degraded" as const, isResolved: true, resolvedAt: new Date() };

  it("sends a recovery email when no prior recovery alert and alertPerformanceDegraded is enabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertPerformanceDegraded: true,
      webhookUrl: null,
    });

    await alertService.notifyPerformanceRecovery(monitor, recoveryIncident);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("back to normal") })
    );
    expect(mockAlertRepo.create).toHaveBeenCalledWith({ userId: "user-1", incidentId: "inc-1", type: "recovery" });
  });

  it("skips when alertPerformanceDegraded is disabled", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(false);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      alertEmail: null,
      alertPerformanceDegraded: false,
      webhookUrl: null,
    });

    await alertService.notifyPerformanceRecovery(monitor, recoveryIncident);

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips sending when cooldown is active (alert already sent)", async () => {
    mockAlertRepo.hasAlertForIncident.mockResolvedValue(true);

    await alertService.notifyPerformanceRecovery(monitor, recoveryIncident);

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockAlertRepo.create).not.toHaveBeenCalled();
  });
});
