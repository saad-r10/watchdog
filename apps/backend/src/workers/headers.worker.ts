import cron from "node-cron";
import axios from "axios";
import { monitorRepository } from "../repositories/monitor.repository";
import { analyseHeaders } from "../lib/monitor-utils";
import { prisma } from "../db";

async function checkHeaders(monitor: { id: string; url: string }) {
  try {
    const res = await axios.get(monitor.url, { timeout: 10_000, validateStatus: () => true });
    const { present, missing, status } = analyseHeaders(res.headers as Record<string, string>);
    await prisma.check.create({
      data: { monitorId: monitor.id, type: "headers", status, headers: { present, missing } },
    });
  } catch {
    await prisma.check.create({
      data: { monitorId: monitor.id, type: "headers", status: "error" },
    });
  }
}

export function startHeadersWorker() {
  cron.schedule("0 */6 * * *", async () => {
    const monitors = await monitorRepository.findAllActive();
    await Promise.allSettled(monitors.map(checkHeaders));
  });
  console.log("Headers worker started");
}
