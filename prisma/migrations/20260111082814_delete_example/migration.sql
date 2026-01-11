/*
  Warnings:

  - You are about to drop the column `example` on the `BibleVerses` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BibleVerses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chapter" INTEGER NOT NULL,
    "verses" INTEGER NOT NULL,
    "bibleSchemaId" INTEGER,
    CONSTRAINT "BibleVerses_bibleSchemaId_fkey" FOREIGN KEY ("bibleSchemaId") REFERENCES "BibleSchema" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BibleVerses" ("bibleSchemaId", "chapter", "id", "verses") SELECT "bibleSchemaId", "chapter", "id", "verses" FROM "BibleVerses";
DROP TABLE "BibleVerses";
ALTER TABLE "new_BibleVerses" RENAME TO "BibleVerses";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
