import { computeAnomalyStats, isAnomalous, ANOMALY_SIGMA, MIN_SAMPLE_SIZE } from "../../lib/anomaly-utils";

function constantSamples(value: number, count: number): number[] {
  return new Array(count).fill(value);
}

describe("computeAnomalyStats", () => {
  it("returns null when there are fewer than MIN_SAMPLE_SIZE samples", () => {
    const samples = new Array(MIN_SAMPLE_SIZE - 1).fill(100);

    expect(computeAnomalyStats(samples)).toBeNull();
  });

  it("returns null when the baseline has zero variance", () => {
    const samples = constantSamples(100, MIN_SAMPLE_SIZE);

    expect(computeAnomalyStats(samples)).toBeNull();
  });

  it("computes mean, stddev, and threshold for a varying baseline", () => {
    // Alternating 90/110 -> mean 100, population stddev 10
    const samples = Array.from({ length: MIN_SAMPLE_SIZE }, (_, i) => (i % 2 === 0 ? 90 : 110));

    const stats = computeAnomalyStats(samples);

    expect(stats).not.toBeNull();
    expect(stats!.mean).toBeCloseTo(100);
    expect(stats!.stddev).toBeCloseTo(10);
    expect(stats!.threshold).toBeCloseTo(100 + ANOMALY_SIGMA * 10);
  });
});

describe("isAnomalous", () => {
  const stats = { mean: 100, stddev: 10, threshold: 130 };

  it("flags a value above the threshold", () => {
    expect(isAnomalous(950, stats)).toBe(true);
  });

  it("does not flag a value within the threshold", () => {
    expect(isAnomalous(105, stats)).toBe(false);
    expect(isAnomalous(130, stats)).toBe(false);
  });
});
