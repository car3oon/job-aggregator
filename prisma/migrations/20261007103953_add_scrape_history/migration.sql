-- CreateTable
CREATE TABLE "ScrapeHistory" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "jobsAdded" INTEGER NOT NULL DEFAULT 0,
    "jobsUpdated" INTEGER NOT NULL DEFAULT 0,
    "logs" TEXT,
    "error" TEXT,

    CONSTRAINT "ScrapeHistory_pkey" PRIMARY KEY ("id")
);
