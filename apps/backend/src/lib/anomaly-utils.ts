// Number of standard deviations above the rolling mean a response time must
// exceed to be considered anomalous.
export const ANOMALY_SIGMA = 3;

// Minimum number of baseline samples required before computing stats -
// avoids flagging brand-new monitors that have no meaningful history yet.
export const MIN_SAMPLE_SIZE = 20;

export interface AnomalyStats {
  mean: number;
  stddev: number;
  threshold: number;
}

/**
 * Computes the mean, standard deviation, and anomaly threshold
 * (mean + ANOMALY_SIGMA * stddev) for a set of baseline samples.
 * Returns null if there aren't enough samples, or if the baseline has zero
 * variance (a flat stddev would make any deviation register as anomalous).
 */
export function computeAnomalyStats(samples: number[]): AnomalyStats | null {
  if (samples.length < MIN_SAMPLE_SIZE) return null;

  const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
  const variance = samples.reduce((sum, v) => sum + (v - mean) ** 2, 0) / samples.length;
  const stddev = Math.sqrt(variance);

  if (stddev === 0) return null;

  return { mean, stddev, threshold: mean + ANOMALY_SIGMA * stddev };
}

export function isAnomalous(latest: number, stats: AnomalyStats): boolean {
  return latest > stats.threshold;
}
