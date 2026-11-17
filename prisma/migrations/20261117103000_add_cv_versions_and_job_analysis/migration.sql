-- CreateTable
CREATE TABLE "CvVersion" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAnalysis" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "requiredSkills" TEXT[],
    "seniority" TEXT,
    "location" TEXT,
    "workMode" TEXT,
    "compensation" TEXT,
    "recommendedCvId" TEXT,
    "cvMatchReason" TEXT,
    "cvMatchStrengths" TEXT[],
    "cvMatchGaps" TEXT[],
    "descriptionHash" TEXT NOT NULL,
    "comparedCvHash" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobAnalysis_jobId_key" ON "JobAnalysis"("jobId");

-- AddForeignKey
ALTER TABLE "JobAnalysis" ADD CONSTRAINT "JobAnalysis_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAnalysis" ADD CONSTRAINT "JobAnalysis_recommendedCvId_fkey" FOREIGN KEY ("recommendedCvId") REFERENCES "CvVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
