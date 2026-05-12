import cron from "node-cron";
import axios from "axios";
import { monitorRepository } from "../repositories/monitor.repository";
import { prisma } from "../db";

async function checkUptime(monitor: { id: string; url: string }) {
  const start = Date.now();
  let status = "down";
  let statusCode: number | null = null;
  try {
    const res = await axios.get(monitor.url, { timeout: 10_000, validateStatus: () => true });
    statusCode = res.status;
    status = res.status < 400 ? "up" : "down";
  } catch {
    status = "down";
  }
  const responseTime = Date.now() - start;
  await prisma.check.create({
    data: { monitorId: monitor.id, type: "uptime", status, statusCode, responseTime },
  });
}

export function startUptimeWorker() {
  cron.schedule("* * * * *", async () => {
    const monitors = await monitorRepository.findAllActive();
    await Promise.allSettled(monitors.map(checkUptime));
  });
  console.log("Uptime worker started");
}
