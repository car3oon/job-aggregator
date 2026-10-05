/*
  Warnings:

  - You are about to drop the column `tags` on the `Job` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "excluded" TEXT[],
ADD COLUMN     "keywords" TEXT[];

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "tags",
ADD COLUMN     "categories" TEXT[],
ADD COLUMN     "workPreferences" TEXT[],
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "workMode" DROP NOT NULL;

-- CreateTable
CREATE TABLE "WorkPreference" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkPreference_name_key" ON "WorkPreference"("name");
