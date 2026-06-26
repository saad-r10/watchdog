import { checkRepository } from "../repositories/check.repository";
import { incidentRepository } from "../repositories/incident.repository";
import { maintenanceRepository } from "../repositories/maintenance.repository";
import { monitorAgentRepository } from "../repositories/monitor-agent.repository";
import { alertService } from "./alert.service";
import { computeAnomalyStats, isAnomalous, MIN_SAMPLE_SIZE } from "../lib/anomaly-utils";
import type { Monitor } from "@prisma/client";
import type { SyntheticCheckResult, LighthouseResult } from "@watchdog/shared-types";

const CLOUD_SOURCE = "__cloud__";

export const monitorStatusService = {
  /**
   * Re-evaluates the aggregate up/down status for a monitor across all of its
   * sources (cloud checker if no agents are assigned, otherwise each assigned
   * agent/region) and opens or resolves the downtime incident based on
   * `monitor.regionDownThreshold` - the number of distinct sources that must
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
   * based on the result of its most recent scripted check. Single-source -
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

  /**
   * Opens or resolves the `performance_degraded` incident for a monitor by
   * comparing its latest response time against a rolling 7-day mean/stddev
   * baseline (z-score). No-ops if there isn't enough history yet or the
   * baseline has zero variance.
   */
  async evaluatePerformanceStatus(monitor: Monitor): Promise<void> {
    const samples = await checkRepository.getRecentResponseTimes(monitor.id, 7);
    if (samples.length < MIN_SAMPLE_SIZE + 1) return;

    const latest = samples[samples.length - 1];
    const stats = computeAnomalyStats(samples.slice(0, -1));
    if (!stats) return;

    const openIncident = await incidentRepository.findOpenPerformanceIncident(monitor.id);

    if (isAnomalous(latest, stats) && !openIncident) {
      const incident = await incidentRepository.create({
        monitor: { connect: { id: monitor.id } },
        type: "performance_degraded",
      });
      const inMaintenance = await maintenanceRepository.isActive(monitor.id);
      if (!inMaintenance) {
        await alertService.notifyPerformanceDegraded(monitor, incident, { latest, ...stats }).catch(console.error);
      }
    } else if (!isAnomalous(latest, stats) && openIncident) {
      const resolved = await incidentRepository.resolve(openIncident.id);
      await alertService.notifyPerformanceRecovery(monitor, resolved).catch(console.error);
    }
  },

  /**
   * Opens or resolves the `lighthouse_budget_exceeded` incident for a monitor
   * by comparing its latest Lighthouse scores against the monitor's
   * per-category budgets. No-ops if the audit itself failed.
   */
  async evaluateLighthouseStatus(monitor: Monitor, result: LighthouseResult): Promise<void> {
    if (!result.success) return;

    const overBudget =
      (result.performance ?? 100) < monitor.lighthousePerformanceBudget ||
      (result.accessibility ?? 100) < monitor.lighthouseAccessibilityBudget ||
      (result.bestPractices ?? 100) < monitor.lighthouseBestPracticesBudget ||
      (result.seo ?? 100) < monitor.lighthouseSeoBudget;

    const openIncident = await incidentRepository.findOpenLighthouseIncident(monitor.id);

    if (overBudget && !openIncident) {
      const incident = await incidentRepository.create({
        monitor: { connect: { id: monitor.id } },
        type: "lighthouse_budget_exceeded",
      });
      const inMaintenance = await maintenanceRepository.isActive(monitor.id);
      if (!inMaintenance) {
        await alertService.notifyLighthouseBudgetExceeded(monitor, incident, result).catch(console.error);
      }
    } else if (!overBudget && openIncident) {
      const resolved = await incidentRepository.resolve(openIncident.id);
      await alertService.notifyLighthouseRecovery(monitor, resolved).catch(console.error);
    }
  },
};
