import cron from "node-cron";
import { monitorRepository } from "../repositories/monitor.repository";
import { analyseExposure } from "../lib/exposure-utils";
import { prisma } from "../db";
import type { Prisma } from "@prisma/client";

async function checkExposure(monitor: { id: string; url: string }) {
  try {
    const findings = await analyseExposure(monitor.url);
    await prisma.check.create({
      data: {
        monitorId: monitor.id,
        type: "exposure",
        status: findings.status,
        exposureFindings: findings as unknown as Prisma.InputJsonValue,
      },
    });
  } catch {
    await prisma.check.create({
      data: { monitorId: monitor.id, type: "exposure", status: "error" },
    });
  }
}

export function startExposureWorker() {
  cron.schedule("0 */6 * * *", async () => {
    const monitors = await monitorRepository.findAllActive();
    await Promise.allSettled(monitors.map(checkExposure));
  });
  console.log("Exposure worker started");
}
