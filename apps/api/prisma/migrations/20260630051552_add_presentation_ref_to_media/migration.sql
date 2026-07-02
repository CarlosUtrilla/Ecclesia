-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Media" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration" REAL,
    "thumbnail" TEXT,
    "fallback" TEXT,
    "folder" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "presentationId" INTEGER,
    CONSTRAINT "Media_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "Presentation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Media" ("createdAt", "deletedAt", "duration", "fallback", "filePath", "fileSize", "folder", "format", "height", "id", "name", "thumbnail", "type", "updatedAt", "width") SELECT "createdAt", "deletedAt", "duration", "fallback", "filePath", "fileSize", "folder", "format", "height", "id", "name", "thumbnail", "type", "updatedAt", "width" FROM "Media";
DROP TABLE "Media";
ALTER TABLE "new_Media" RENAME TO "Media";
CREATE UNIQUE INDEX "Media_filePath_key" ON "Media"("filePath");
CREATE UNIQUE INDEX "Media_presentationId_key" ON "Media"("presentationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
