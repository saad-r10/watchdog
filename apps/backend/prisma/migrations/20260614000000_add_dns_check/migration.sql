-- DNS hygiene checks (SPF/DKIM/DMARC, dangling CNAME)
ALTER TYPE "CheckType" ADD VALUE 'dns';

ALTER TABLE "Check" ADD COLUMN "dnsFindings" JSONB;
