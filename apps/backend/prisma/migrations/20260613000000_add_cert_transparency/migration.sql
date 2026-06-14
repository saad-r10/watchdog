-- Certificate Transparency monitoring (crt.sh)
ALTER TYPE "CheckType" ADD VALUE 'cert_transparency';
ALTER TYPE "IncidentType" ADD VALUE 'unexpected_cert';

ALTER TABLE "Check" ADD COLUMN "ctNewCerts" JSONB;
ALTER TABLE "User" ADD COLUMN "alertCertTransparency" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MonitorCertificate" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "crtShId" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "issuerName" TEXT NOT NULL,
    "nameValue" TEXT NOT NULL,
    "notBefore" TIMESTAMP(3) NOT NULL,
    "notAfter" TIMESTAMP(3) NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonitorCertificate_monitorId_crtShId_key" ON "MonitorCertificate"("monitorId", "crtShId");

-- AddForeignKey
ALTER TABLE "MonitorCertificate" ADD CONSTRAINT "MonitorCertificate_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
