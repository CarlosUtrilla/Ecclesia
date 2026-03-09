-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SelectedScreens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "screenId" INTEGER NOT NULL,
    "screenName" TEXT NOT NULL,
    "rol" TEXT,
    "stageThemeId" INTEGER,
    "stageLayout" TEXT NOT NULL DEFAULT '{"widgets":[]}',
    "stageState" TEXT NOT NULL DEFAULT '{"message":null,"timers":[]}',
    CONSTRAINT "SelectedScreens_stageThemeId_fkey" FOREIGN KEY ("stageThemeId") REFERENCES "Themes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SelectedScreens" ("id", "rol", "screenId", "screenName") SELECT "id", "rol", "screenId", "screenName" FROM "SelectedScreens";
DROP TABLE "SelectedScreens";
ALTER TABLE "new_SelectedScreens" RENAME TO "SelectedScreens";
CREATE UNIQUE INDEX "SelectedScreens_screenId_key" ON "SelectedScreens"("screenId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
