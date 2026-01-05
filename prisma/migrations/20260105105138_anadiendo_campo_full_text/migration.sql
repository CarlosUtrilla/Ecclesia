/*
  Warnings:

  - You are about to drop the column `artist` on the `Song` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Song" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "copyright" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fullText" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Song" ("author", "copyright", "createdAt", "id", "title", "updatedAt") SELECT "author", "copyright", "createdAt", "id", "title", "updatedAt" FROM "Song";
DROP TABLE "Song";
ALTER TABLE "new_Song" RENAME TO "Song";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
