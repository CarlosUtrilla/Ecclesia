/*
  Warnings:

  - You are about to drop the column `songsTagsId` on the `Lyrics` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lyrics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "tagSongsId" INTEGER,
    "songId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lyrics_tagSongsId_fkey" FOREIGN KEY ("tagSongsId") REFERENCES "TagSongs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lyrics_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Lyrics" ("content", "createdAt", "id", "songId", "tagSongsId", "updatedAt") SELECT "content", "createdAt", "id", "songId", "tagSongsId", "updatedAt" FROM "Lyrics";
DROP TABLE "Lyrics";
ALTER TABLE "new_Lyrics" RENAME TO "Lyrics";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
