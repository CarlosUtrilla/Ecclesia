-- =============================================================================
-- BETA v1 BASELINE MIGRATION
-- Generada el 2026-03-09 como consolidación de todas las migraciones previas.
-- Esta es la migración inicial oficial para el primer release de beta.
-- Usa IF NOT EXISTS para ser idempotente en bases de datos parcialmente migradas.
-- =============================================================================

-- CreateTable
CREATE TABLE IF NOT EXISTS "Song" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "copyright" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fullText" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Lyrics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "tagSongsId" INTEGER,
    "songId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lyrics_tagSongsId_fkey" FOREIGN KEY ("tagSongsId") REFERENCES "TagSongs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lyrics_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TagSongs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "shortCut" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Font" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Themes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "backgroundMediaId" INTEGER,
    "textStyle" TEXT NOT NULL,
    "animationSettings" TEXT NOT NULL DEFAULT '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}',
    "transitionSettings" TEXT NOT NULL DEFAULT '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}',
    "previewImage" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "useDefaultBibleSettings" BOOLEAN NOT NULL DEFAULT true,
    "biblePresentationSettingsId" INTEGER,
    CONSTRAINT "Themes_backgroundMediaId_fkey" FOREIGN KEY ("backgroundMediaId") REFERENCES "Media" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Themes_biblePresentationSettingsId_fkey" FOREIGN KEY ("biblePresentationSettingsId") REFERENCES "BiblePresentationSettings" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Setting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Media" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Presentation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "slides" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BibleSchema" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "book" TEXT NOT NULL,
    "book_id" INTEGER NOT NULL,
    "book_short" TEXT NOT NULL,
    "testament" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BibleVerses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chapter" INTEGER NOT NULL,
    "verses" INTEGER NOT NULL,
    "bibleSchemaId" INTEGER,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BibleVerses_bibleSchemaId_fkey" FOREIGN KEY ("bibleSchemaId") REFERENCES "BibleSchema" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BiblePresentationSettings" (
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
CREATE TABLE IF NOT EXISTS "Schedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "dateFrom" DATETIME,
    "dateTo" DATETIME,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ScheduleGroupTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ScheduleItem" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "accessData" TEXT NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SelectedScreens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "screenId" INTEGER NOT NULL,
    "screenName" TEXT NOT NULL,
    "rol" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StageScreenConfig" (
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
CREATE TABLE IF NOT EXISTS "SyncState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lastPulledAt" DATETIME,
    "lastPushedAt" DATETIME,
    "lastAckedChangeId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SyncOutboxChange" (
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
CREATE TABLE IF NOT EXISTS "SyncInboxChange" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "TagSongs_name_key" ON "TagSongs"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TagSongs_shortName_key" ON "TagSongs"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TagSongs_shortCut_key" ON "TagSongs"("shortCut");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Themes_name_key" ON "Themes"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Media_filePath_key" ON "Media"("filePath");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleItem_id_key" ON "ScheduleItem"("id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SelectedScreens_screenId_key" ON "SelectedScreens"("screenId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StageScreenConfig_selectedScreenId_key" ON "StageScreenConfig"("selectedScreenId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StageScreenConfig_themeId_idx" ON "StageScreenConfig"("themeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SyncState_workspaceId_deviceId_key" ON "SyncState"("workspaceId", "deviceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncOutboxChange_workspaceId_deviceId_ackedAt_id_idx" ON "SyncOutboxChange"("workspaceId", "deviceId", "ackedAt", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncOutboxChange_workspaceId_id_idx" ON "SyncOutboxChange"("workspaceId", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncInboxChange_workspaceId_appliedAt_id_idx" ON "SyncInboxChange"("workspaceId", "appliedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SyncInboxChange_workspaceId_sourceDeviceId_remoteChangeId_key" ON "SyncInboxChange"("workspaceId", "sourceDeviceId", "remoteChangeId");

-- AlterTable: agregar columnas faltantes a Themes (para upgrades desde versiones antiguas)
-- Estas sentencias pueden fallar individualmente si la columna ya existe — eso es esperado.
ALTER TABLE "Themes" ADD COLUMN "textStyle" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Themes" ADD COLUMN "transitionSettings" TEXT NOT NULL DEFAULT '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}';
ALTER TABLE "Themes" ADD COLUMN "useDefaultBibleSettings" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Themes" ADD COLUMN "biblePresentationSettingsId" INTEGER;
