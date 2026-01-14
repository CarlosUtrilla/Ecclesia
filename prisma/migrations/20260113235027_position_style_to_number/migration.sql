/*
  Warnings:

  - You are about to alter the column `positionStyle` on the `BiblePresentationSettings` table. The data in that column could be lost. The data in that column will be cast from `String` to `Float`.

*/
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
    "defaultTheme" INTEGER
);
INSERT INTO "new_BiblePresentationSettings" ("defaultTheme", "description", "id", "isGlobal", "position", "positionStyle", "showVerseNumber", "showVersion") SELECT "defaultTheme", "description", "id", "isGlobal", "position", "positionStyle", "showVerseNumber", "showVersion" FROM "BiblePresentationSettings";
DROP TABLE "BiblePresentationSettings";
ALTER TABLE "new_BiblePresentationSettings" RENAME TO "BiblePresentationSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
