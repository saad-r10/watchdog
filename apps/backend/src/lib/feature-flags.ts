export const syntheticMonitoringEnabled = (): boolean =>
  process.env.SYNTHETIC_MONITORING_ENABLED === "true";
