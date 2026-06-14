import cron from "node-cron";
import { monitorRepository } from "../repositories/monitor.repository";
import { incidentRepository } from "../repositories/incident.repository";
import { alertService } from "../services/alert.service";
import { analyseBlocklist } from "../lib/blocklist-utils";
import { prisma } from "../db";
import type { Monitor, Prisma } from "@prisma/client";

async function checkBlocklist(monitor: Monitor) {
  try {
    const { hostname } = new URL(monitor.url);
    const findings = await analyseBlocklist(hostname);

    await prisma.check.create({
      data: {
        monitorId: monitor.id,
        type: "blocklist",
        status: findings.status,
        blocklistFindings: findings as unknown as Prisma.InputJsonValue,
      },
    });

    const openIncident = await incidentRepository.findOpenBlocklistIncident(monitor.id);

    if (findings.status === "listed" && !openIncident) {
      const incident = await incidentRepository.create({
        monitor: { connect: { id: monitor.id } },
        type: "domain_blocklisted",
      });
      alertService.notifyDomainBlocklisted(monitor, incident, findings).catch(console.error);
    } else if (findings.status === "clean" && openIncident) {
      await incidentRepository.resolve(openIncident.id);
    }
  } catch {
    await prisma.check.create({
      data: { monitorId: monitor.id, type: "blocklist", status: "error" },
    });
  }
}

export function startBlocklistWorker() {
  cron.schedule("0 3 * * *", async () => {
    const monitors = await monitorRepository.findAllActive();
    await Promise.allSettled(monitors.map(checkBlocklist));
  });
  console.log("Blocklist worker started");
}
