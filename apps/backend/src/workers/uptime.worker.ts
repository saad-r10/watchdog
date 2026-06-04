import cron from "node-cron";
import axios from "axios";
import { monitorRepository } from "../repositories/monitor.repository";
import { checkRepository } from "../repositories/check.repository";
import { incidentRepository } from "../repositories/incident.repository";
import { maintenanceRepository } from "../repositories/maintenance.repository";
import { alertService } from "../services/alert.service";
import type { Monitor } from "@prisma/client";

async function checkUptime(monitor: Monitor) {
  const lastCheck = await checkRepository.getLatest(monitor.id);
  if (lastCheck) {
    const elapsed = Date.now() - new Date(lastCheck.checkedAt).getTime();
    if (elapsed < monitor.intervalMinutes * 60_000) return;
  }

  const start = Date.now();
  let status: "up" | "down" = "down";
  let statusCode: number | null = null;

  try {
    const res = await axios.get(monitor.url, { timeout: 10_000, validateStatus: () => true });
    statusCode = res.status;
    status = res.status < 400 ? "up" : "down";
  } catch {
    status = "down";
  }

  const responseTime = Date.now() - start;
  await checkRepository.create({
    monitor: { connect: { id: monitor.id } },
    type: "uptime",
    status,
    statusCode,
    responseTime,
  });

  const openIncident = await incidentRepository.findOpenByMonitor(monitor.id);

  if (status === "down" && !openIncident) {
    const incident = await incidentRepository.create({
      monitor: { connect: { id: monitor.id } },
      type: "downtime",
    });
    const inMaintenance = await maintenanceRepository.isActive(monitor.id);
    if (!inMaintenance) {
      alertService.notifyDowntime(monitor, incident).catch(console.error);
    }
  } else if (status === "up" && openIncident) {
    const resolved = await incidentRepository.resolve(openIncident.id);
    alertService.notifyRecovery(monitor, resolved).catch(console.error);
  }
}

export function startUptimeWorker() {
  cron.schedule("* * * * *", async () => {
    const monitors = await monitorRepository.findAllActive();
    await Promise.allSettled(monitors.map(checkUptime));
  });
  console.log("Uptime worker started");
}
