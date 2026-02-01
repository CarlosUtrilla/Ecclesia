/*
  Warnings:

  - Added the required column `groupTemplateId` to the `ScheduleGroup` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ScheduleGropTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScheduleGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "groupTemplateId" INTEGER NOT NULL,
    CONSTRAINT "ScheduleGroup_groupTemplateId_fkey" FOREIGN KEY ("groupTemplateId") REFERENCES "ScheduleGropTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleGroup" ("color", "id", "name", "order") SELECT "color", "id", "name", "order" FROM "ScheduleGroup";
DROP TABLE "ScheduleGroup";
ALTER TABLE "new_ScheduleGroup" RENAME TO "ScheduleGroup";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
