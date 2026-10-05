-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "scraperUrlId" TEXT;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_scraperUrlId_fkey" FOREIGN KEY ("scraperUrlId") REFERENCES "ScraperUrl"("id") ON DELETE SET NULL ON UPDATE CASCADE;
