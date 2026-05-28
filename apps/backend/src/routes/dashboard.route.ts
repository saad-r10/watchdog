import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { monitorRepository } from "../repositories/monitor.repository";
import { checkRepository } from "../repositories/check.repository";
import { incidentRepository } from "../repositories/incident.repository";

const router = Router();
router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const monitors = await monitorRepository.findByUser(userId);
    const monitorIds = monitors.map((m) => m.id);

    if (monitorIds.length === 0) {
      return res.json({
        success: true,
        data: {
          summary: { total: 0, up: 0, down: 0, unknown: 0, avgUptime: null, activeIncidents: 0 },
          recentIncidents: [],
        },
      });
    }

    const [latestChecks, uptimeStats, recentIncidents] = await Promise.all([
      checkRepository.findLatestPerMonitor(monitorIds),
      checkRepository.getBulkUptimeStats(monitorIds, 7),
      incidentRepository.findRecentByUser(userId, 15),
    ]);

    const statusByMonitor = new Map(latestChecks.map((c) => [c.monitorId, c.status]));
    let up = 0, down = 0, unknown = 0;
    for (const m of monitors) {
      const s = statusByMonitor.get(m.id);
      if (s === "up") up++;
      else if (s === "down") down++;
      else unknown++;
    }

    const activeIncidents = recentIncidents.filter((i) => !i.isResolved).length;

    const uptimeByMonitor = new Map(uptimeStats.map((r) => [r.monitorId, r]));
    const monitorUptimes: number[] = [];
    for (const m of monitors) {
      const row = uptimeByMonitor.get(m.id);
      if (row && row.total > 0) {
        monitorUptimes.push(row.upCount / row.total);
      }
    }
    const avgUptime =
      monitorUptimes.length > 0
        ? Math.round((monitorUptimes.reduce((a, b) => a + b, 0) / monitorUptimes.length) * 1000) / 10
        : null;

    const formattedIncidents = recentIncidents.map((i) => ({
      id: i.id,
      monitorId: i.monitorId,
      monitorName: i.monitor.name,
      monitorUrl: i.monitor.url,
      type: i.type,
      startedAt: i.startedAt,
      resolvedAt: i.resolvedAt,
      isResolved: i.isResolved,
      durationMinutes:
        i.isResolved && i.resolvedAt
          ? Math.round((new Date(i.resolvedAt).getTime() - new Date(i.startedAt).getTime()) / 60_000)
          : null,
    }));

    res.json({
      success: true,
      data: {
        summary: { total: monitors.length, up, down, unknown, avgUptime, activeIncidents },
        recentIncidents: formattedIncidents,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
