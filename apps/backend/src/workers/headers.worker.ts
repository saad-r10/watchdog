import cron from "node-cron";
import axios from "axios";
import { monitorRepository } from "../repositories/monitor.repository";
import { prisma } from "../db";

const SECURITY_HEADERS = [
  "x-frame-options",
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];

async function checkHeaders(monitor: { id: string; url: string }) {
  try {
    const res = await axios.get(monitor.url, { timeout: 10_000, validateStatus: () => true });
    const present: Record<string, string> = {};
    const missing: string[] = [];
    for (const h of SECURITY_HEADERS) {
      if (res.headers[h]) present[h] = res.headers[h];
      else missing.push(h);
    }
    const status = missing.length === 0 ? "pass" : "fail";
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
