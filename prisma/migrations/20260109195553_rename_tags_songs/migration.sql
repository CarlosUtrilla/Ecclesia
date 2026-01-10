/*
  Warnings:

  - You are about to drop the `SongsTags` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `tagSongsId` to the `Lyrics` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "SongsTags_shortCut_key";

-- DropIndex
DROP INDEX "SongsTags_name_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SongsTags";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "TagSongs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "shortCut" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lyrics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "songId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "songsTagsId" INTEGER NOT NULL,
    "tagSongsId" INTEGER NOT NULL,
    CONSTRAINT "Lyrics_tagSongsId_fkey" FOREIGN KEY ("tagSongsId") REFERENCES "TagSongs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lyrics_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Lyrics" ("content", "createdAt", "id", "songId", "songsTagsId", "updatedAt") SELECT "content", "createdAt", "id", "songId", "songsTagsId", "updatedAt" FROM "Lyrics";
DROP TABLE "Lyrics";
ALTER TABLE "new_Lyrics" RENAME TO "Lyrics";
CREATE UNIQUE INDEX "Lyrics_songId_key" ON "Lyrics"("songId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TagSongs_name_key" ON "TagSongs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TagSongs_shortCut_key" ON "TagSongs"("shortCut");
