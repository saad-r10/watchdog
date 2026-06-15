-- Synthetic multi-step transaction monitoring (Playwright-based)
CREATE TYPE "MonitorType" AS ENUM ('http', 'synthetic');

ALTER TABLE "Monitor" ADD COLUMN "type" "MonitorType" NOT NULL DEFAULT 'http';
ALTER TABLE "Monitor" ADD COLUMN "syntheticSteps" JSONB;

ALTER TABLE "Check" ADD COLUMN "syntheticResult" JSONB;

ALTER TYPE "CheckType" ADD VALUE 'synthetic';
ALTER TYPE "IncidentType" ADD VALUE 'synthetic_failure';

ALTER TABLE "User" ADD COLUMN "alertSyntheticFailure" BOOLEAN NOT NULL DEFAULT true;
