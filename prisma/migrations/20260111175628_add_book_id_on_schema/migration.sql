/*
  Warnings:

  - Added the required column `book_id` to the `BibleSchema` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BibleSchema" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "book" TEXT NOT NULL,
    "book_id" TEXT NOT NULL
);
INSERT INTO "new_BibleSchema" ("book", "id") SELECT "book", "id" FROM "BibleSchema";
DROP TABLE "BibleSchema";
ALTER TABLE "new_BibleSchema" RENAME TO "BibleSchema";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
