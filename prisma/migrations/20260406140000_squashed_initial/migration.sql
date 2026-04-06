-- CreateTable
CREATE TABLE "Song" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "copyright" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "lyrics" TEXT NOT NULL DEFAULT '[]',
    "fullText" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "TagSongs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "shortCut" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Font" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Themes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "backgroundVideoLoop" BOOLEAN NOT NULL DEFAULT true,
    "backgroundMediaId" INTEGER,
    "textStyle" TEXT NOT NULL,
    "animationSettings" TEXT NOT NULL DEFAULT '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}',
    "transitionSettings" TEXT NOT NULL DEFAULT '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}',
    "previewImage" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "useDefaultBibleSettings" BOOLEAN NOT NULL DEFAULT true,
    "biblePresentationSettingsId" INTEGER,
    CONSTRAINT "Themes_backgroundMediaId_fkey" FOREIGN KEY ("backgroundMediaId") REFERENCES "Media" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Themes_biblePresentationSettingsId_fkey" FOREIGN KEY ("biblePresentationSettingsId") REFERENCES "BiblePresentationSettings" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Media" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration" REAL,
    "thumbnail" TEXT,
    "fallback" TEXT,
    "folder" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Presentation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "slides" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "BibleSchema" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "book" TEXT NOT NULL,
    "book_id" INTEGER NOT NULL,
    "book_short" TEXT NOT NULL,
    "testament" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BibleVerses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chapter" INTEGER NOT NULL,
    "verses" INTEGER NOT NULL,
    "bibleSchemaId" INTEGER,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BibleVerses_bibleSchemaId_fkey" FOREIGN KEY ("bibleSchemaId") REFERENCES "BibleSchema" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BiblePresentationSettings" (
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

-- CreateTable
CREATE TABLE "Schedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "dateFrom" DATETIME,
    "dateTo" DATETIME,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ScheduleGroupTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ScheduleItem" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "accessData" TEXT NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SelectedScreens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "screenId" BIGINT NOT NULL,
    "screenName" TEXT NOT NULL,
    "rol" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StageScreenConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "selectedScreenId" INTEGER NOT NULL,
    "themeId" INTEGER,
    "layout" TEXT NOT NULL DEFAULT '{"version":1,"items":[]}',
    "state" TEXT NOT NULL DEFAULT '{"message":null,"timers":[]}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StageScreenConfig_selectedScreenId_fkey" FOREIGN KEY ("selectedScreenId") REFERENCES "SelectedScreens" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StageScreenConfig_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Themes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lastPulledAt" DATETIME,
    "lastPushedAt" DATETIME,
    "lastAckedChangeId" INTEGER,
    "lastAppliedSnapshotAt" DATETIME,
    "snapshotApplySequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncOutboxChange" (
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

-- CreateTable
CREATE TABLE "SyncInboxChange" (
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

-- CreateIndex
CREATE UNIQUE INDEX "TagSongs_name_key" ON "TagSongs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TagSongs_shortName_key" ON "TagSongs"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX "TagSongs_shortCut_key" ON "TagSongs"("shortCut");

-- CreateIndex
CREATE UNIQUE INDEX "Themes_name_key" ON "Themes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Media_filePath_key" ON "Media"("filePath");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleItem_id_key" ON "ScheduleItem"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SelectedScreens_screenId_key" ON "SelectedScreens"("screenId");

-- CreateIndex
CREATE UNIQUE INDEX "StageScreenConfig_selectedScreenId_key" ON "StageScreenConfig"("selectedScreenId");

-- CreateIndex
CREATE INDEX "StageScreenConfig_themeId_idx" ON "StageScreenConfig"("themeId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_workspaceId_deviceId_key" ON "SyncState"("workspaceId", "deviceId");

-- CreateIndex
CREATE INDEX "SyncOutboxChange_workspaceId_deviceId_ackedAt_id_idx" ON "SyncOutboxChange"("workspaceId", "deviceId", "ackedAt", "id");

-- CreateIndex
CREATE INDEX "SyncOutboxChange_workspaceId_id_idx" ON "SyncOutboxChange"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "SyncInboxChange_workspaceId_appliedAt_id_idx" ON "SyncInboxChange"("workspaceId", "appliedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SyncInboxChange_workspaceId_sourceDeviceId_remoteChangeId_key" ON "SyncInboxChange"("workspaceId", "sourceDeviceId", "remoteChangeId");

