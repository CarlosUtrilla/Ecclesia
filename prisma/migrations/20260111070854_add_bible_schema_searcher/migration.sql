-- CreateTable
CREATE TABLE "BibleSchema" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "book" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "BibleVerses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "book" TEXT NOT NULL,
    "initialVerse" INTEGER NOT NULL,
    "finalVerse" INTEGER NOT NULL,
    "bibleSchemaId" INTEGER,
    CONSTRAINT "BibleVerses_bibleSchemaId_fkey" FOREIGN KEY ("bibleSchemaId") REFERENCES "BibleSchema" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
