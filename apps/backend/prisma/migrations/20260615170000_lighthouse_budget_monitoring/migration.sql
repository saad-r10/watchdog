-- Lighthouse CI performance/accessibility/SEO budget monitoring (opt-in per monitor)
ALTER TYPE "CheckType" ADD VALUE 'lighthouse';
ALTER TYPE "IncidentType" ADD VALUE 'lighthouse_budget_exceeded';

ALTER TABLE "Monitor" ADD COLUMN "lighthouseEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Monitor" ADD COLUMN "lighthousePerformanceBudget" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "Monitor" ADD COLUMN "lighthouseAccessibilityBudget" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "Monitor" ADD COLUMN "lighthouseBestPracticesBudget" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "Monitor" ADD COLUMN "lighthouseSeoBudget" INTEGER NOT NULL DEFAULT 80;

ALTER TABLE "Check" ADD COLUMN "lighthouseResult" JSONB;

ALTER TABLE "User" ADD COLUMN "alertLighthouseBudget" BOOLEAN NOT NULL DEFAULT true;
