-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SelectedScreens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "screenId" BIGINT NOT NULL,
    "screenName" TEXT NOT NULL,
    "rol" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SelectedScreens" ("id", "screenId", "screenName", "rol", "updatedAt")
    SELECT "id", "screenId", "screenName", "rol", "updatedAt" FROM "SelectedScreens";
DROP TABLE "SelectedScreens";
ALTER TABLE "new_SelectedScreens" RENAME TO "SelectedScreens";
CREATE UNIQUE INDEX "SelectedScreens_screenId_key" ON "SelectedScreens"("screenId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
