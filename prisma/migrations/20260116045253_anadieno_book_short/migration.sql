/*
  Warnings:

  - You are about to alter the column `book_id` on the `BibleSchema` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - Added the required column `book_short` to the `BibleSchema` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BibleSchema" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "book" TEXT NOT NULL,
    "book_id" INTEGER NOT NULL,
    "book_short" TEXT NOT NULL,
    "testament" TEXT NOT NULL
);
INSERT INTO "new_BibleSchema" ("book", "book_id", "id", "testament") SELECT "book", "book_id", "id", "testament" FROM "BibleSchema";
DROP TABLE "BibleSchema";
ALTER TABLE "new_BibleSchema" RENAME TO "BibleSchema";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
