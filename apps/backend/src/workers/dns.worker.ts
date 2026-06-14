import cron from "node-cron";
import { monitorRepository } from "../repositories/monitor.repository";
import { analyseDns } from "../lib/dns-utils";
import { prisma } from "../db";
import type { Prisma } from "@prisma/client";

async function checkDns(monitor: { id: string; url: string }) {
  try {
    const { hostname } = new URL(monitor.url);
    const findings = await analyseDns(hostname);
    await prisma.check.create({
      data: {
        monitorId: monitor.id,
        type: "dns",
        status: findings.status,
        dnsFindings: findings as unknown as Prisma.InputJsonValue,
      },
    });
  } catch {
    await prisma.check.create({
      data: { monitorId: monitor.id, type: "dns", status: "error" },
    });
  }
}

export function startDnsWorker() {
  cron.schedule("0 */6 * * *", async () => {
    const monitors = await monitorRepository.findAllActive();
    await Promise.allSettled(monitors.map(checkDns));
  });
  console.log("DNS worker started");
}
