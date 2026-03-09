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

-- Migrate existing stage config data from SelectedScreens into StageScreenConfig
INSERT INTO "StageScreenConfig" ("selectedScreenId", "themeId", "layout", "state", "createdAt", "updatedAt")
SELECT
  "id" as "selectedScreenId",
  "stageThemeId" as "themeId",
  COALESCE("stageLayout", '{"version":1,"items":[]}') as "layout",
  COALESCE("stageState", '{"message":null,"timers":[]}') as "state",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "SelectedScreens"
WHERE "rol" = 'STAGE_SCREEN';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SelectedScreens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "screenId" INTEGER NOT NULL,
    "screenName" TEXT NOT NULL,
    "rol" TEXT
);
INSERT INTO "new_SelectedScreens" ("id", "screenId", "screenName", "rol")
SELECT "id", "screenId", "screenName", "rol"
FROM "SelectedScreens";
DROP TABLE "SelectedScreens";
ALTER TABLE "new_SelectedScreens" RENAME TO "SelectedScreens";
CREATE UNIQUE INDEX "SelectedScreens_screenId_key" ON "SelectedScreens"("screenId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StageScreenConfig_selectedScreenId_key" ON "StageScreenConfig"("selectedScreenId");

-- CreateIndex
CREATE INDEX "StageScreenConfig_themeId_idx" ON "StageScreenConfig"("themeId");
