-- Add webhookUrl to User
ALTER TABLE "User" ADD COLUMN "webhookUrl" TEXT;

-- CreateTable Agent
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_keyHash_key" ON "Agent"("keyHash");

-- AddForeignKey Agent -> User
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add agentId to Monitor
ALTER TABLE "Monitor" ADD COLUMN "agentId" TEXT;

-- AddForeignKey Monitor -> Agent
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable StatusPage
CREATE TABLE "StatusPage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StatusPage_slug_key" ON "StatusPage"("slug");

-- AddForeignKey StatusPage -> User
ALTER TABLE "StatusPage" ADD CONSTRAINT "StatusPage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable StatusPageMonitor
CREATE TABLE "StatusPageMonitor" (
    "statusPageId" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,

    CONSTRAINT "StatusPageMonitor_pkey" PRIMARY KEY ("statusPageId","monitorId")
);

-- AddForeignKey StatusPageMonitor -> StatusPage
ALTER TABLE "StatusPageMonitor" ADD CONSTRAINT "StatusPageMonitor_statusPageId_fkey" FOREIGN KEY ("statusPageId") REFERENCES "StatusPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey StatusPageMonitor -> Monitor
ALTER TABLE "StatusPageMonitor" ADD CONSTRAINT "StatusPageMonitor_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable MaintenanceWindow
CREATE TABLE "MaintenanceWindow" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceWindow_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey MaintenanceWindow -> Monitor
ALTER TABLE "MaintenanceWindow" ADD CONSTRAINT "MaintenanceWindow_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
