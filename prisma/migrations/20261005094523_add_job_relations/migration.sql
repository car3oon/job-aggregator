/*
  Warnings:

  - You are about to drop the column `categories` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `workPreferences` on the `Job` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Job" DROP COLUMN "categories",
DROP COLUMN "workPreferences";

-- CreateTable
CREATE TABLE "_JobToWorkPreference" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_JobToWorkPreference_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CategoryToJob" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CategoryToJob_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_JobToWorkPreference_B_index" ON "_JobToWorkPreference"("B");

-- CreateIndex
CREATE INDEX "_CategoryToJob_B_index" ON "_CategoryToJob"("B");

-- AddForeignKey
ALTER TABLE "_JobToWorkPreference" ADD CONSTRAINT "_JobToWorkPreference_A_fkey" FOREIGN KEY ("A") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JobToWorkPreference" ADD CONSTRAINT "_JobToWorkPreference_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkPreference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToJob" ADD CONSTRAINT "_CategoryToJob_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CategoryToJob" ADD CONSTRAINT "_CategoryToJob_B_fkey" FOREIGN KEY ("B") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
