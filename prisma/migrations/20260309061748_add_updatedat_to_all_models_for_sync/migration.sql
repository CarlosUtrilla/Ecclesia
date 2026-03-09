-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BiblePresentationSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "description" TEXT NOT NULL DEFAULT 'complete',
    "position" TEXT NOT NULL DEFAULT 'underText',
    "showVersion" BOOLEAN NOT NULL DEFAULT true,
    "showVerseNumber" BOOLEAN NOT NULL DEFAULT false,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "positionStyle" REAL,
    "defaultTheme" INTEGER,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_BiblePresentationSettings" ("defaultTheme", "description", "id", "isGlobal", "position", "positionStyle", "showVerseNumber", "showVersion") SELECT "defaultTheme", "description", "id", "isGlobal", "position", "positionStyle", "showVerseNumber", "showVersion" FROM "BiblePresentationSettings";
DROP TABLE "BiblePresentationSettings";
ALTER TABLE "new_BiblePresentationSettings" RENAME TO "BiblePresentationSettings";
CREATE TABLE "new_BibleSchema" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "book" TEXT NOT NULL,
    "book_id" INTEGER NOT NULL,
    "book_short" TEXT NOT NULL,
    "testament" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_BibleSchema" ("book", "book_id", "book_short", "id", "testament") SELECT "book", "book_id", "book_short", "id", "testament" FROM "BibleSchema";
DROP TABLE "BibleSchema";
ALTER TABLE "new_BibleSchema" RENAME TO "BibleSchema";
CREATE TABLE "new_BibleVerses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chapter" INTEGER NOT NULL,
    "verses" INTEGER NOT NULL,
    "bibleSchemaId" INTEGER,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BibleVerses_bibleSchemaId_fkey" FOREIGN KEY ("bibleSchemaId") REFERENCES "BibleSchema" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BibleVerses" ("bibleSchemaId", "chapter", "id", "verses") SELECT "bibleSchemaId", "chapter", "id", "verses" FROM "BibleVerses";
DROP TABLE "BibleVerses";
ALTER TABLE "new_BibleVerses" RENAME TO "BibleVerses";
CREATE TABLE "new_Font" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Font" ("createdAt", "fileName", "filePath", "id", "name") SELECT "createdAt", "fileName", "filePath", "id", "name" FROM "Font";
DROP TABLE "Font";
ALTER TABLE "new_Font" RENAME TO "Font";
CREATE TABLE "new_Schedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "dateFrom" DATETIME,
    "dateTo" DATETIME,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Schedule" ("dateFrom", "dateTo", "id", "title") SELECT "dateFrom", "dateTo", "id", "title" FROM "Schedule";
DROP TABLE "Schedule";
ALTER TABLE "new_Schedule" RENAME TO "Schedule";
CREATE TABLE "new_ScheduleGroupTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ScheduleGroupTemplate" ("color", "id", "name") SELECT "color", "id", "name" FROM "ScheduleGroupTemplate";
DROP TABLE "ScheduleGroupTemplate";
ALTER TABLE "new_ScheduleGroupTemplate" RENAME TO "ScheduleGroupTemplate";
CREATE TABLE "new_ScheduleItem" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "accessData" TEXT NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleItem" ("accessData", "id", "order", "scheduleId", "type") SELECT "accessData", "id", "order", "scheduleId", "type" FROM "ScheduleItem";
DROP TABLE "ScheduleItem";
ALTER TABLE "new_ScheduleItem" RENAME TO "ScheduleItem";
CREATE UNIQUE INDEX "ScheduleItem_id_key" ON "ScheduleItem"("id");
CREATE TABLE "new_SelectedScreens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "screenId" INTEGER NOT NULL,
    "screenName" TEXT NOT NULL,
    "rol" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SelectedScreens" ("id", "rol", "screenId", "screenName") SELECT "id", "rol", "screenId", "screenName" FROM "SelectedScreens";
DROP TABLE "SelectedScreens";
ALTER TABLE "new_SelectedScreens" RENAME TO "SelectedScreens";
CREATE UNIQUE INDEX "SelectedScreens_screenId_key" ON "SelectedScreens"("screenId");
CREATE TABLE "new_SyncInboxChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" TEXT NOT NULL,
    "sourceDeviceId" TEXT NOT NULL,
    "remoteChangeId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "entityUpdatedAt" DATETIME,
    "deletedAt" DATETIME,
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SyncInboxChange" ("appliedAt", "createdAt", "deletedAt", "entityUpdatedAt", "id", "operation", "payload", "recordId", "remoteChangeId", "sourceDeviceId", "tableName", "workspaceId") SELECT "appliedAt", "createdAt", "deletedAt", "entityUpdatedAt", "id", "operation", "payload", "recordId", "remoteChangeId", "sourceDeviceId", "tableName", "workspaceId" FROM "SyncInboxChange";
DROP TABLE "SyncInboxChange";
ALTER TABLE "new_SyncInboxChange" RENAME TO "SyncInboxChange";
CREATE INDEX "SyncInboxChange_workspaceId_appliedAt_id_idx" ON "SyncInboxChange"("workspaceId", "appliedAt", "id");
CREATE UNIQUE INDEX "SyncInboxChange_workspaceId_sourceDeviceId_remoteChangeId_key" ON "SyncInboxChange"("workspaceId", "sourceDeviceId", "remoteChangeId");
CREATE TABLE "new_SyncOutboxChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "entityUpdatedAt" DATETIME,
    "deletedAt" DATETIME,
    "ackedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SyncOutboxChange" ("ackedAt", "createdAt", "deletedAt", "deviceId", "entityUpdatedAt", "id", "operation", "payload", "recordId", "tableName", "workspaceId") SELECT "ackedAt", "createdAt", "deletedAt", "deviceId", "entityUpdatedAt", "id", "operation", "payload", "recordId", "tableName", "workspaceId" FROM "SyncOutboxChange";
DROP TABLE "SyncOutboxChange";
ALTER TABLE "new_SyncOutboxChange" RENAME TO "SyncOutboxChange";
CREATE INDEX "SyncOutboxChange_workspaceId_deviceId_ackedAt_id_idx" ON "SyncOutboxChange"("workspaceId", "deviceId", "ackedAt", "id");
CREATE INDEX "SyncOutboxChange_workspaceId_id_idx" ON "SyncOutboxChange"("workspaceId", "id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
