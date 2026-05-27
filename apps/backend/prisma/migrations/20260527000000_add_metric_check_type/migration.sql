-- Add metric columns to Check
ALTER TABLE "Check" ADD COLUMN "metricName" TEXT;
ALTER TABLE "Check" ADD COLUMN "metricValue" DOUBLE PRECISION;

-- Add metric to CheckType enum
ALTER TYPE "CheckType" ADD VALUE 'metric';
