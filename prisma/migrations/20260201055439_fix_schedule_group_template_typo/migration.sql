/*
  Warnings:

  - You are about to drop the `ScheduleGropTemplate` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ScheduleGropTemplate";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ScheduleGroupTemplate" (
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
    CONSTRAINT "ScheduleGroup_groupTemplateId_fkey" FOREIGN KEY ("groupTemplateId") REFERENCES "ScheduleGroupTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleGroup" ("color", "groupTemplateId", "id", "name", "order") SELECT "color", "groupTemplateId", "id", "name", "order" FROM "ScheduleGroup";
DROP TABLE "ScheduleGroup";
ALTER TABLE "new_ScheduleGroup" RENAME TO "ScheduleGroup";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
