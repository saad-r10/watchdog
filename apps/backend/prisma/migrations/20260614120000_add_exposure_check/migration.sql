-- security.txt and common exposed-path checks
ALTER TYPE "CheckType" ADD VALUE 'exposure';

ALTER TABLE "Check" ADD COLUMN "exposureFindings" JSONB;
