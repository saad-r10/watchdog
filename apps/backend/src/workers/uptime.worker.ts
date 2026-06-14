import cron from "node-cron";
import { timedRequest } from "../lib/timed-request";
import { hashContent } from "../lib/content-hash";
import { monitorRepository } from "../repositories/monitor.repository";
import { checkRepository } from "../repositories/check.repository";
import { incidentRepository } from "../repositories/incident.repository";
import { alertService } from "../services/alert.service";
import { monitorStatusService } from "../services/monitor-status.service";
import type { Monitor } from "@prisma/client";

async function checkUptime(monitor: Monitor) {
  const lastCheck = await checkRepository.getLatest(monitor.id);
  if (lastCheck) {
    const elapsed = Date.now() - new Date(lastCheck.checkedAt).getTime();
    if (elapsed < monitor.intervalMinutes * 60_000) return;
  }

  const result = await timedRequest(monitor.url, { timeoutMs: 10_000, captureBody: monitor.contentChangeEnabled });
  const { statusCode, timings } = result;
  const status: "up" | "down" = result.ok && statusCode !== null && statusCode < 400 ? "up" : "down";
  const contentHash = monitor.contentChangeEnabled && result.ok && result.body ? hashContent(result.body) : null;

  await checkRepository.create({
    monitor: { connect: { id: monitor.id } },
    type: "uptime",
    status,
    statusCode,
    responseTime: timings.totalMs,
    dnsMs: timings.dnsMs,
    tcpMs: timings.tcpMs,
    tlsMs: timings.tlsMs,
    ttfbMs: timings.ttfbMs,
    downloadMs: timings.downloadMs,
    sizeBytes: timings.sizeBytes,
    contentHash,
  });

  await monitorStatusService.evaluateUptimeStatus(monitor);

  const previousHash = lastCheck?.contentHash ?? null;
  const isSnoozed = !!monitor.contentChangeSnoozeUntil && monitor.contentChangeSnoozeUntil > new Date();
  if (contentHash && previousHash && previousHash !== contentHash && !isSnoozed) {
    const incident = await incidentRepository.create({
      monitor: { connect: { id: monitor.id } },
      type: "content_changed",
      isResolved: true,
      resolvedAt: new Date(),
    });
    alertService.notifyContentChanged(monitor, incident).catch(console.error);
  }
}

export function startUptimeWorker() {
  cron.schedule("* * * * *", async () => {
    const monitors = await monitorRepository.findAllActive();
    await Promise.allSettled(monitors.map(checkUptime));
  });
  console.log("Uptime worker started");
}
