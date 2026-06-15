import { checkRepository } from "../repositories/check.repository";
import { incidentRepository } from "../repositories/incident.repository";
import { maintenanceRepository } from "../repositories/maintenance.repository";
import { monitorAgentRepository } from "../repositories/monitor-agent.repository";
import { alertService } from "./alert.service";
import type { Monitor } from "@prisma/client";
import type { SyntheticCheckResult } from "@watchdog/shared-types";

const CLOUD_SOURCE = "__cloud__";

export const monitorStatusService = {
  /**
   * Re-evaluates the aggregate up/down status for a monitor across all of its
   * sources (cloud checker if no agents are assigned, otherwise each assigned
   * agent/region) and opens or resolves the downtime incident based on
   * `monitor.regionDownThreshold` — the number of distinct sources that must
   * be reporting "down" at once.
   */
  async evaluateUptimeStatus(monitor: Monitor): Promise<void> {
    const agentIds = await monitorAgentRepository.findAgentIdsByMonitor(monitor.id);
    const sources = agentIds.length > 0 ? agentIds : [CLOUD_SOURCE];

    const latest = await checkRepository.getLatestUptimePerSource(monitor.id);
    const latestBySource = new Map(latest.map((row) => [row.agentId ?? CLOUD_SOURCE, row]));

    const downCount = sources.filter((s) => latestBySource.get(s)?.status === "down").length;
    const threshold = Math.min(Math.max(monitor.regionDownThreshold, 1), sources.length);

    const openIncident = await incidentRepository.findOpenByMonitor(monitor.id);

    if (downCount >= threshold && !openIncident) {
      const incident = await incidentRepository.create({
        monitor: { connect: { id: monitor.id } },
        type: "downtime",
      });
      const inMaintenance = await maintenanceRepository.isActive(monitor.id);
      if (!inMaintenance) {
        await alertService.notifyDowntime(monitor, incident).catch(console.error);
      }
    } else if (downCount < threshold && openIncident) {
      const resolved = await incidentRepository.resolve(openIncident.id);
      await alertService.notifyRecovery(monitor, resolved).catch(console.error);
    }
  },

  /**
   * Opens or resolves the `synthetic_failure` incident for a synthetic monitor
   * based on the result of its most recent scripted check. Single-source —
   * synthetic checks always run from Watchdog's own infrastructure.
   */
  async evaluateSyntheticStatus(monitor: Monitor, result: SyntheticCheckResult): Promise<void> {
    const openIncident = await incidentRepository.findOpenSyntheticIncident(monitor.id);

    if (!result.success && !openIncident) {
      const incident = await incidentRepository.create({
        monitor: { connect: { id: monitor.id } },
        type: "synthetic_failure",
      });
      const inMaintenance = await maintenanceRepository.isActive(monitor.id);
      if (!inMaintenance) {
        await alertService.notifySyntheticFailure(monitor, incident, result).catch(console.error);
      }
    } else if (result.success && openIncident) {
      const resolved = await incidentRepository.resolve(openIncident.id);
      await alertService.notifySyntheticRecovery(monitor, resolved).catch(console.error);
    }
  },
};
