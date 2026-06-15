import cron from "node-cron";
import { runLighthouseCheck } from "../lib/lighthouse-runner";
import { lighthouseMonitoringEnabled } from "../lib/feature-flags";
import { monitorRepository } from "../repositories/monitor.repository";
import { checkRepository } from "../repositories/check.repository";
import { monitorStatusService } from "../services/monitor-status.service";
import type { Monitor, Prisma } from "@prisma/client";

const CONCURRENCY = 2;

async function checkLighthouse(monitor: Monitor) {
  const result = await runLighthouseCheck(monitor.url);

  await checkRepository.create({
    monitor: { connect: { id: monitor.id } },
    type: "lighthouse",
    status: result.success ? "ok" : "error",
    lighthouseResult: result as unknown as Prisma.InputJsonValue,
  });

  await monitorStatusService.evaluateLighthouseStatus(monitor, result);
}

export function startLighthouseWorker() {
  cron.schedule("0 3 * * *", async () => {
    if (!lighthouseMonitoringEnabled()) return;
    const monitors = await monitorRepository.findAllLighthouseEnabled();
    for (let i = 0; i < monitors.length; i += CONCURRENCY) {
      await Promise.allSettled(monitors.slice(i, i + CONCURRENCY).map(checkLighthouse));
    }
  });
  console.log("Lighthouse worker started");
}
