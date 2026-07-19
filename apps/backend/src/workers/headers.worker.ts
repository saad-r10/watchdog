import cron from "node-cron";
import axios from "axios";
import { assertSsrfSafe } from "../lib/ssrf-guard";
import { monitorRepository } from "../repositories/monitor.repository";
import { analyseHeaders, analyseCookies, analyseMixedContent } from "../lib/monitor-utils";
import { prisma } from "../db";
import type { Prisma } from "@prisma/client";

async function checkHeaders(monitor: { id: string; url: string }) {
  try {
    await assertSsrfSafe(monitor.url);
    const res = await axios.get(monitor.url, { timeout: 10_000, validateStatus: () => true });
    const isHttps = monitor.url.toLowerCase().startsWith("https://");
    const { present, missing } = analyseHeaders(res.headers as Record<string, string>);
    const cookies = analyseCookies(res.headers["set-cookie"], isHttps);
    const mixedContent = analyseMixedContent(res.data, monitor.url);

    const hasCookieIssues = cookies.some((c) => c.missingSecure || c.missingHttpOnly || c.missingSameSite);
    const status = missing.length === 0 && !hasCookieIssues && mixedContent.length === 0 ? "pass" : "fail";

    await prisma.check.create({
      data: {
        monitorId: monitor.id,
        type: "headers",
        status,
        headers: { present, missing, cookies, mixedContent } as unknown as Prisma.InputJsonValue,
      },
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
