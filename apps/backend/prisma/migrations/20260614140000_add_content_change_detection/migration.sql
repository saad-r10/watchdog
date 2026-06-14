-- Content-change detection for defacement alerts
ALTER TYPE "IncidentType" ADD VALUE 'content_changed';

ALTER TABLE "Monitor" ADD COLUMN "contentChangeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Monitor" ADD COLUMN "contentChangeSnoozeUntil" TIMESTAMP(3);

ALTER TABLE "Check" ADD COLUMN "contentHash" TEXT;

ALTER TABLE "User" ADD COLUMN "alertContentChange" BOOLEAN NOT NULL DEFAULT true;
