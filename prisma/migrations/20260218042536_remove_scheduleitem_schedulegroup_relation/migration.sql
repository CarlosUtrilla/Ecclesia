/*
  Warnings:

  - You are about to drop the column `scheduleGroupId` on the `ScheduleItem` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScheduleItem" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "accessData" TEXT NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleItem" ("accessData", "id", "order", "scheduleId", "type") SELECT "accessData", "id", "order", "scheduleId", "type" FROM "ScheduleItem";
DROP TABLE "ScheduleItem";
ALTER TABLE "new_ScheduleItem" RENAME TO "ScheduleItem";
CREATE UNIQUE INDEX "ScheduleItem_id_key" ON "ScheduleItem"("id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
