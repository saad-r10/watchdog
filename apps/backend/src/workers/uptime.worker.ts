import cron from "node-cron";
import axios from "axios";
import { monitorRepository } from "../repositories/monitor.repository";
import { checkRepository } from "../repositories/check.repository";
import { incidentRepository } from "../repositories/incident.repository";

async function checkUptime(monitor: { id: string; url: string }) {
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
    await incidentRepository.create({
      monitor: { connect: { id: monitor.id } },
      type: "downtime",
    });
  } else if (status === "up" && openIncident) {
    await incidentRepository.resolve(openIncident.id);
  }
}

export function startUptimeWorker() {
  cron.schedule("* * * * *", async () => {
    const monitors = await monitorRepository.findAllActive();
    await Promise.allSettled(monitors.map(checkUptime));
  });
  console.log("Uptime worker started");
}
