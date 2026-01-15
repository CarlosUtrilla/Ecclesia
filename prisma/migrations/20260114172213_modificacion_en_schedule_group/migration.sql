-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScheduleGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "scheduleId" INTEGER,
    CONSTRAINT "ScheduleGroup_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleGroup" ("color", "id", "name", "order") SELECT "color", "id", "name", "order" FROM "ScheduleGroup";
DROP TABLE "ScheduleGroup";
ALTER TABLE "new_ScheduleGroup" RENAME TO "ScheduleGroup";
CREATE TABLE "new_ScheduleItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "accessData" TEXT NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "scheduleGroupId" INTEGER,
    CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleItem" ("accessData", "id", "order", "scheduleGroupId", "scheduleId", "type") SELECT "accessData", "id", "order", "scheduleGroupId", "scheduleId", "type" FROM "ScheduleItem";
DROP TABLE "ScheduleItem";
ALTER TABLE "new_ScheduleItem" RENAME TO "ScheduleItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
