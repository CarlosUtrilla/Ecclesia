/*
  Warnings:

  - You are about to drop the column `book` on the `BibleVerses` table. All the data in the column will be lost.
  - You are about to drop the column `finalVerse` on the `BibleVerses` table. All the data in the column will be lost.
  - You are about to drop the column `initialVerse` on the `BibleVerses` table. All the data in the column will be lost.
  - Added the required column `chapter` to the `BibleVerses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `verses` to the `BibleVerses` table without a default value. This is not possible if the table is not empty.

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
INSERT INTO "new_BibleVerses" ("bibleSchemaId", "id") SELECT "bibleSchemaId", "id" FROM "BibleVerses";
DROP TABLE "BibleVerses";
ALTER TABLE "new_BibleVerses" RENAME TO "BibleVerses";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
