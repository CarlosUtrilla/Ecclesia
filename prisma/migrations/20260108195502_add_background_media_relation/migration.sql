-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Themes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "backgroundMediaId" INTEGER,
    "textColor" TEXT NOT NULL,
    "textSize" INTEGER NOT NULL,
    "lineHeight" REAL NOT NULL,
    "letterSpacing" REAL NOT NULL,
    "fontFamily" TEXT NOT NULL,
    "textAlign" TEXT NOT NULL,
    "bold" BOOLEAN NOT NULL DEFAULT false,
    "italic" BOOLEAN NOT NULL DEFAULT false,
    "underline" BOOLEAN NOT NULL DEFAULT false,
    "animationSettings" TEXT NOT NULL DEFAULT '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}',
    "previewImage" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Themes_backgroundMediaId_fkey" FOREIGN KEY ("backgroundMediaId") REFERENCES "Media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Themes" ("animationSettings", "background", "bold", "createdAt", "fontFamily", "id", "italic", "letterSpacing", "lineHeight", "name", "previewImage", "textAlign", "textColor", "textSize", "underline", "updatedAt") SELECT "animationSettings", "background", "bold", "createdAt", "fontFamily", "id", "italic", "letterSpacing", "lineHeight", "name", "previewImage", "textAlign", "textColor", "textSize", "underline", "updatedAt" FROM "Themes";
DROP TABLE "Themes";
ALTER TABLE "new_Themes" RENAME TO "Themes";
CREATE UNIQUE INDEX "Themes_name_key" ON "Themes"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
