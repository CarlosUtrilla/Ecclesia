/*
  Warnings:

  - The primary key for the `ScheduleGroup` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `ScheduleItem` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScheduleGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "groupTemplateId" INTEGER NOT NULL,
    "scheduleId" INTEGER,
    CONSTRAINT "ScheduleGroup_groupTemplateId_fkey" FOREIGN KEY ("groupTemplateId") REFERENCES "ScheduleGroupTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleGroup_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleGroup" ("color", "groupTemplateId", "id", "name", "order", "scheduleId") SELECT "color", "groupTemplateId", "id", "name", "order", "scheduleId" FROM "ScheduleGroup";
DROP TABLE "ScheduleGroup";
ALTER TABLE "new_ScheduleGroup" RENAME TO "ScheduleGroup";
CREATE UNIQUE INDEX "ScheduleGroup_id_key" ON "ScheduleGroup"("id");
CREATE TABLE "new_ScheduleItem" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "accessData" TEXT NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "scheduleGroupId" TEXT,
    CONSTRAINT "ScheduleItem_scheduleGroupId_fkey" FOREIGN KEY ("scheduleGroupId") REFERENCES "ScheduleGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleItem" ("accessData", "id", "order", "scheduleGroupId", "scheduleId", "type") SELECT "accessData", "id", "order", "scheduleGroupId", "scheduleId", "type" FROM "ScheduleItem";
DROP TABLE "ScheduleItem";
ALTER TABLE "new_ScheduleItem" RENAME TO "ScheduleItem";
CREATE UNIQUE INDEX "ScheduleItem_id_key" ON "ScheduleItem"("id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
