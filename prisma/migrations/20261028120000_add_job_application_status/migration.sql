-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('INBOX', 'SAVED', 'APPLIED', 'REJECTED');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN "applicationStatus" "ApplicationStatus" NOT NULL DEFAULT 'INBOX',
ADD COLUMN "appliedAt" TIMESTAMP(3);
