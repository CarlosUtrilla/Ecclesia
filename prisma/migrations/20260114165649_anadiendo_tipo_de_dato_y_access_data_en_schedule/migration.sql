/*
  Warnings:

  - You are about to drop the column `data` on the `ScheduleItem` table. All the data in the column will be lost.
  - Added the required column `accessData` to the `ScheduleItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `ScheduleItem` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScheduleItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "accessData" TEXT NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "scheduleGroupId" INTEGER NOT NULL,
    CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleItem_scheduleGroupId_fkey" FOREIGN KEY ("scheduleGroupId") REFERENCES "ScheduleGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleItem" ("id", "order", "scheduleGroupId", "scheduleId") SELECT "id", "order", "scheduleGroupId", "scheduleId" FROM "ScheduleItem";
DROP TABLE "ScheduleItem";
ALTER TABLE "new_ScheduleItem" RENAME TO "ScheduleItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
