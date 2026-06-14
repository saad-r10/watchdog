-- Domain reputation / blocklist check (URLhaus, Spamhaus DBL)
ALTER TYPE "CheckType" ADD VALUE 'blocklist';
ALTER TYPE "IncidentType" ADD VALUE 'domain_blocklisted';

ALTER TABLE "Check" ADD COLUMN "blocklistFindings" JSONB;
ALTER TABLE "User" ADD COLUMN "alertBlocklist" BOOLEAN NOT NULL DEFAULT true;
