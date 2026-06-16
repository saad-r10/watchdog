import { statusPageRepository } from "../repositories/status-page.repository";
import { checkRepository } from "../repositories/check.repository";
import type { PublicStatusPage } from "@watchdog/shared-types";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

  async getFeed(slug: string, baseUrl: string): Promise<string> {
    const page = await statusPageRepository.findBySlug(slug);
    if (!page) notFound();

    const monitorIds = page.monitors.map(({ monitor }) => monitor.id);
    const incidents = await statusPageRepository.getRecentIncidents(monitorIds);

    const statusUrl = `${baseUrl}/status/${slug}`;

    const items = incidents
      .map((inc) => {
        const typeLabel = inc.type.replace(/_/g, " ");
        const statusText = inc.isResolved
          ? `Resolved at ${inc.resolvedAt!.toUTCString()}`
          : "Ongoing";
        return `
    <item>
      <title>${escapeXml(`${inc.monitor.name}: ${typeLabel}`)}</title>
      <description>${escapeXml(statusText)}</description>
      <pubDate>${inc.startedAt.toUTCString()}</pubDate>
      <guid isPermaLink="false">${inc.id}</guid>
      <link>${escapeXml(statusUrl)}</link>
    </item>`;
      })
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(page.title)} – Incidents</title>
    <link>${escapeXml(statusUrl)}</link>
    <description>Incident history for ${escapeXml(page.title)}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}
  </channel>
</rss>`;
  },
};
