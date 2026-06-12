-- Add HTTP timing breakdown + payload size to Check (all nullable: old rows/agents keep working)
ALTER TABLE "Check" ADD COLUMN "dnsMs" INTEGER;
ALTER TABLE "Check" ADD COLUMN "tcpMs" INTEGER;
ALTER TABLE "Check" ADD COLUMN "tlsMs" INTEGER;
ALTER TABLE "Check" ADD COLUMN "ttfbMs" INTEGER;
ALTER TABLE "Check" ADD COLUMN "downloadMs" INTEGER;
ALTER TABLE "Check" ADD COLUMN "sizeBytes" INTEGER;
