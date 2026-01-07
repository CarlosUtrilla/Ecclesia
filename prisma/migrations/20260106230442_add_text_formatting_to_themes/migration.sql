-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Themes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "textColor" TEXT NOT NULL,
    "textSize" INTEGER NOT NULL,
    "lineHeight" REAL NOT NULL,
    "letterSpacing" REAL NOT NULL,
    "fontFamily" TEXT NOT NULL,
    "textAlign" TEXT NOT NULL,
    "bold" BOOLEAN NOT NULL DEFAULT false,
    "italic" BOOLEAN NOT NULL DEFAULT false,
    "underline" BOOLEAN NOT NULL DEFAULT false,
    "previewImage" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Themes" ("background", "createdAt", "fontFamily", "id", "letterSpacing", "lineHeight", "name", "previewImage", "textAlign", "textColor", "textSize", "updatedAt") SELECT "background", "createdAt", "fontFamily", "id", "letterSpacing", "lineHeight", "name", "previewImage", "textAlign", "textColor", "textSize", "updatedAt" FROM "Themes";
DROP TABLE "Themes";
ALTER TABLE "new_Themes" RENAME TO "Themes";
CREATE UNIQUE INDEX "Themes_name_key" ON "Themes"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
