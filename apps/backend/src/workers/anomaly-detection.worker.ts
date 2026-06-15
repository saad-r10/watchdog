import cron from "node-cron";
import { monitorRepository } from "../repositories/monitor.repository";
import { monitorStatusService } from "../services/monitor-status.service";

export function startAnomalyDetectionWorker() {
  cron.schedule("*/15 * * * *", async () => {
    const monitors = await monitorRepository.findAllActiveHttp();
    await Promise.allSettled(monitors.map((m) => monitorStatusService.evaluatePerformanceStatus(m)));
  });
  console.log("Anomaly detection worker started");
}
