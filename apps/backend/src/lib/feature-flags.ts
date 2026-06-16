export const syntheticMonitoringEnabled = (): boolean =>
  process.env.SYNTHETIC_MONITORING_ENABLED === "true";

export const lighthouseMonitoringEnabled = (): boolean =>
  process.env.LIGHTHOUSE_MONITORING_ENABLED === "true";
