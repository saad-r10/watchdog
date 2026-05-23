import { statusPageRepository } from "../repositories/status-page.repository";
import { checkRepository } from "../repositories/check.repository";
import type { PublicStatusPage } from "@watchdog/shared-types";

function notFound(): never {
  const err = new Error("Status page not found") as any;
  err.status = 404;
  throw err;
}

export const statusPageService = {
  async list(userId: string) {
    return statusPageRepository.findByUser(userId);
  },

  async create(userId: string, slug: string, title: string) {
    try {
      return await statusPageRepository.create({ userId, slug, title });
    } catch (err: any) {
      if (err.code === "P2002") {
        const conflict = new Error("Slug already taken") as any;
        conflict.status = 409;
        throw conflict;
      }
      throw err;
    }
  },

  async delete(id: string, userId: string) {
    const page = await statusPageRepository.findById(id);
    if (!page || page.userId !== userId) notFound();
    await statusPageRepository.delete(id);
  },

  async setMonitors(id: string, userId: string, monitorIds: string[]) {
    const page = await statusPageRepository.findById(id);
    if (!page || page.userId !== userId) notFound();
    await statusPageRepository.setMonitors(id, monitorIds);
  },

  async getPublic(slug: string): Promise<PublicStatusPage> {
    const page = await statusPageRepository.findBySlug(slug);
    if (!page) notFound();

    const monitorEntries = await Promise.all(
      page.monitors.map(async ({ monitor }) => {
        const latest = await checkRepository.getLatest(monitor.id);
        const dailyBars = await statusPageRepository.getDailyBars(monitor.id);

        const uptimeValues = dailyBars
          .filter((b) => b.uptimePercent !== null)
          .map((b) => b.uptimePercent as number);
        const uptimePercent =
          uptimeValues.length === 0
            ? null
            : Math.round((uptimeValues.reduce((a, b) => a + b, 0) / uptimeValues.length) * 10) / 10;

        return {
          id: monitor.id,
          name: monitor.name,
          url: monitor.url,
          status: (latest?.status ?? "unknown") as "up" | "down" | "unknown",
          uptimePercent,
          dailyBars,
        };
      })
    );

    const statuses = monitorEntries.map((m) => m.status);
    const overall =
      statuses.every((s) => s === "up")
        ? "operational"
        : statuses.some((s) => s === "down")
          ? statuses.every((s) => s === "down")
            ? "outage"
            : "degraded"
          : "operational";

    return {
      page: { slug: page.slug, title: page.title },
      overall: overall as "operational" | "degraded" | "outage",
      monitors: monitorEntries,
      updatedAt: new Date().toISOString(),
    };
  },
};
