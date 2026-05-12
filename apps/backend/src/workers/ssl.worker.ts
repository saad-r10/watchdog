import cron from "node-cron";
import tls from "tls";
import { URL } from "url";
import { monitorRepository } from "../repositories/monitor.repository";
import { incidentRepository } from "../repositories/incident.repository";
import { alertService } from "../services/alert.service";
import { prisma } from "../db";
import { getSslStatus, SSL_EXPIRY_WARN_DAYS } from "../lib/monitor-utils";
import type { Monitor } from "@prisma/client";

function getSslDaysLeft(hostname: string): Promise<{ daysLeft: number; validTo: Date }> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname }, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      if (!cert?.valid_to) return reject(new Error("No certificate"));
      const validTo = new Date(cert.valid_to);
      const daysLeft = Math.floor((validTo.getTime() - Date.now()) / 86_400_000);
      resolve({ daysLeft, validTo });
    });
    socket.on("error", reject);
    socket.setTimeout(10_000, () => { socket.destroy(); reject(new Error("Timeout")); });
  });
}

async function checkSsl(monitor: Monitor) {
  try {
    const { hostname } = new URL(monitor.url);
    const { daysLeft } = await getSslDaysLeft(hostname);
    const status = getSslStatus(daysLeft);

    await prisma.check.create({
      data: { monitorId: monitor.id, type: "ssl", status, sslDaysLeft: daysLeft },
    });

    const openIncident = await incidentRepository.findOpenSslIncident(monitor.id);

    if (daysLeft <= SSL_EXPIRY_WARN_DAYS && !openIncident) {
      const incident = await incidentRepository.create({
        monitor: { connect: { id: monitor.id } },
        type: "ssl_expiry",
      });
      alertService.notifySslExpiry(monitor, incident, daysLeft).catch(console.error);
    } else if (daysLeft > SSL_EXPIRY_WARN_DAYS && openIncident) {
      await incidentRepository.resolve(openIncident.id);
    }
  } catch {
    await prisma.check.create({
      data: { monitorId: monitor.id, type: "ssl", status: "error" },
    });
  }
}

export function startSslWorker() {
  cron.schedule("0 * * * *", async () => {
    const monitors = await monitorRepository.findAllActive();
    await Promise.allSettled(monitors.map(checkSsl));
  });
  console.log("SSL worker started");
}
