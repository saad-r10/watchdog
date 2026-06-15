-- Response-time anomaly detection (rolling mean/stddev z-score)
ALTER TYPE "IncidentType" ADD VALUE 'performance_degraded';

ALTER TABLE "User" ADD COLUMN "alertPerformanceDegraded" BOOLEAN NOT NULL DEFAULT true;
