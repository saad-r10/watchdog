-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'admin', 'viewer');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "role"          "UserRole" NOT NULL DEFAULT 'owner',
  ADD COLUMN "mfaEnabled"    BOOLEAN    NOT NULL DEFAULT false,
  ADD COLUMN "mfaSecret"     TEXT,
  ADD COLUMN "loginAttempts" INTEGER    NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil"   TIMESTAMP(3);
