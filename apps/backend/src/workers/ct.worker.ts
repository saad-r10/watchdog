import cron from "node-cron";
import { monitorRepository } from "../repositories/monitor.repository";
import { monitorCertificateRepository } from "../repositories/monitor-certificate.repository";
import { incidentRepository } from "../repositories/incident.repository";
import { alertService } from "../services/alert.service";
import { prisma } from "../db";
import { fetchCertTransparencyEntries } from "../lib/crtsh";
import type { Monitor, Prisma } from "@prisma/client";

async function checkCertTransparency(monitor: Monitor) {
  try {
    const { hostname } = new URL(monitor.url);
    const entries = await fetchCertTransparencyEntries(hostname);

    const known = await monitorCertificateRepository.findByMonitor(monitor.id);
    const knownIds = new Set(known.map((c) => c.crtShId));
    const isFirstRun = known.length === 0;
    const newEntries = entries.filter((e) => !knownIds.has(String(e.id)));

    if (newEntries.length > 0) {
      await monitorCertificateRepository.createMany(
        newEntries.map((e) => ({
          monitorId: monitor.id,
          crtShId: String(e.id),
          commonName: e.common_name ?? "",
          issuerName: e.issuer_name ?? "",
          nameValue: e.name_value ?? "",
          notBefore: new Date(e.not_before),
          notAfter: new Date(e.not_after),
        }))
      );
    }

    const status = newEntries.length === 0 ? "ok" : isFirstRun ? "baseline" : "new_cert";

    await prisma.check.create({
      data: {
        monitorId: monitor.id,
        type: "cert_transparency",
        status,
        ctNewCerts: newEntries.length > 0 ? (newEntries as unknown as Prisma.InputJsonValue) : undefined,
      },
    });

    if (!isFirstRun && newEntries.length > 0) {
      const incident = await incidentRepository.create({
        monitor: { connect: { id: monitor.id } },
        type: "unexpected_cert",
        isResolved: true,
        resolvedAt: new Date(),
      });
      alertService.notifyUnexpectedCert(monitor, incident, newEntries).catch(console.error);
    }
  } catch {
    await prisma.check.create({
      data: { monitorId: monitor.id, type: "cert_transparency", status: "error" },
    });
  }
}

export function startCtWorker() {
  cron.schedule("0 */4 * * *", async () => {
    const monitors = await monitorRepository.findAllActive();
    await Promise.allSettled(monitors.map(checkCertTransparency));
  });
  console.log("Certificate Transparency worker started");
}
