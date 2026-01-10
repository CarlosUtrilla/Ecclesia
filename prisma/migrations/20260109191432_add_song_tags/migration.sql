/*
  Warnings:

  - Added the required column `songsTagsId` to the `Lyrics` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "SongsTags" (
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
    CONSTRAINT "Lyrics_songsTagsId_fkey" FOREIGN KEY ("songsTagsId") REFERENCES "SongsTags" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lyrics_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Lyrics" ("content", "createdAt", "id", "songId", "updatedAt") SELECT "content", "createdAt", "id", "songId", "updatedAt" FROM "Lyrics";
DROP TABLE "Lyrics";
ALTER TABLE "new_Lyrics" RENAME TO "Lyrics";
CREATE UNIQUE INDEX "Lyrics_songId_key" ON "Lyrics"("songId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SongsTags_name_key" ON "SongsTags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SongsTags_shortCut_key" ON "SongsTags"("shortCut");
