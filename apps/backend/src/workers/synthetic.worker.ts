import cron from "node-cron";
import { runSyntheticCheck } from "../lib/synthetic-runner";
import { syntheticMonitoringEnabled } from "../lib/feature-flags";
import { monitorRepository } from "../repositories/monitor.repository";
import { checkRepository } from "../repositories/check.repository";
import { monitorStatusService } from "../services/monitor-status.service";
import type { Monitor, Prisma } from "@prisma/client";
import type { SyntheticStep } from "@watchdog/shared-types";

async function checkSynthetic(monitor: Monitor) {
  const steps = monitor.syntheticSteps as unknown as SyntheticStep[] | null;
  if (!steps || steps.length === 0) return;

  const intervalMinutes = Math.max(monitor.intervalMinutes, 5);
  const lastCheck = await checkRepository.findLatestByType(monitor.id, "synthetic");
  if (lastCheck) {
    const elapsed = Date.now() - new Date(lastCheck.checkedAt).getTime();
    if (elapsed < intervalMinutes * 60_000) return;
  }

  const result = await runSyntheticCheck(steps);

  await checkRepository.create({
    monitor: { connect: { id: monitor.id } },
    type: "synthetic",
    status: result.success ? "up" : "down",
    responseTime: result.totalDurationMs,
    syntheticResult: result as unknown as Prisma.InputJsonValue,
  });

  await monitorStatusService.evaluateSyntheticStatus(monitor, result);
}

export function startSyntheticWorker() {
  cron.schedule("*/5 * * * *", async () => {
    if (!syntheticMonitoringEnabled()) return;
    const monitors = await monitorRepository.findAllSynthetic();
    await Promise.allSettled(monitors.map(checkSynthetic));
  });
  console.log("Synthetic worker started");
}
