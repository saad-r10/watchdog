import cron from "node-cron";
import tls from "tls";
import { URL } from "url";
import { monitorRepository } from "../repositories/monitor.repository";
import { prisma } from "../db";

function getSslDaysLeft(hostname: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname }, () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      if (!cert?.valid_to) return reject(new Error("No cert"));
      const expiry = new Date(cert.valid_to).getTime();
      resolve(Math.floor((expiry - Date.now()) / 86_400_000));
    });
    socket.on("error", reject);
    socket.setTimeout(10_000, () => { socket.destroy(); reject(new Error("Timeout")); });
  });
}

async function checkSsl(monitor: { id: string; url: string }) {
  try {
    const { hostname } = new URL(monitor.url);
    const sslDaysLeft = await getSslDaysLeft(hostname);
    const status = sslDaysLeft > 0 ? "valid" : "expired";
    await prisma.check.create({
      data: { monitorId: monitor.id, type: "ssl", status, sslDaysLeft },
    });
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
