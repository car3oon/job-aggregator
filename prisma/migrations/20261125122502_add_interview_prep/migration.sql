-- CreateTable
CREATE TABLE "InterviewPrep" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "technicalQuestions" TEXT[],
    "behavioralQuestions" TEXT[],
    "talkingPoints" TEXT[],
    "questionsToAsk" TEXT[],
    "redFlags" TEXT[],
    "prepPriorities" TEXT[],
    "descriptionHash" TEXT NOT NULL,
    "comparedCvHash" TEXT,
    "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewPrep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPrep_jobId_key" ON "InterviewPrep"("jobId");

-- AddForeignKey
ALTER TABLE "InterviewPrep" ADD CONSTRAINT "InterviewPrep_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
