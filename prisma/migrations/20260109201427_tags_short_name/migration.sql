/*
  Warnings:

  - Added the required column `shortName` to the `TagSongs` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TagSongs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "shortCut" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TagSongs" ("color", "createdAt", "id", "name", "shortCut", "updatedAt") SELECT "color", "createdAt", "id", "name", "shortCut", "updatedAt" FROM "TagSongs";
DROP TABLE "TagSongs";
ALTER TABLE "new_TagSongs" RENAME TO "TagSongs";
CREATE UNIQUE INDEX "TagSongs_name_key" ON "TagSongs"("name");
CREATE UNIQUE INDEX "TagSongs_shortName_key" ON "TagSongs"("shortName");
CREATE UNIQUE INDEX "TagSongs_shortCut_key" ON "TagSongs"("shortCut");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
