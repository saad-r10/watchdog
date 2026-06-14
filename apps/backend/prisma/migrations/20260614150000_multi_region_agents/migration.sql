-- Multi-region uptime checks via distributed agents

-- Region label for agents
ALTER TABLE "Agent" ADD COLUMN "region" TEXT;

-- Per-monitor "down" threshold across regions/agents (default = old single-source behavior)
ALTER TABLE "Monitor" ADD COLUMN "regionDownThreshold" INTEGER NOT NULL DEFAULT 1;

-- Track which agent produced a Check (NULL = cloud checker)
ALTER TABLE "Check" ADD COLUMN "agentId" TEXT;
ALTER TABLE "Check" ADD CONSTRAINT "Check_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Many-to-many monitor <-> agent assignments (multi-region)
CREATE TABLE "MonitorAgent" (
    "monitorId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorAgent_pkey" PRIMARY KEY ("monitorId","agentId")
);

ALTER TABLE "MonitorAgent" ADD CONSTRAINT "MonitorAgent_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonitorAgent" ADD CONSTRAINT "MonitorAgent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing single-agent assignments
INSERT INTO "MonitorAgent" ("monitorId", "agentId")
SELECT "id", "agentId" FROM "Monitor" WHERE "agentId" IS NOT NULL;

-- Drop the old single-agent column
ALTER TABLE "Monitor" DROP CONSTRAINT "Monitor_agentId_fkey";
ALTER TABLE "Monitor" DROP COLUMN "agentId";
