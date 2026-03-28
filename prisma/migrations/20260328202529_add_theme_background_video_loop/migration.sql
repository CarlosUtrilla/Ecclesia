-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Themes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "backgroundVideoLoop" BOOLEAN NOT NULL DEFAULT true,
    "backgroundMediaId" INTEGER,
    "textStyle" TEXT NOT NULL,
    "animationSettings" TEXT NOT NULL DEFAULT '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}',
    "transitionSettings" TEXT NOT NULL DEFAULT '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}',
    "previewImage" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "useDefaultBibleSettings" BOOLEAN NOT NULL DEFAULT true,
    "biblePresentationSettingsId" INTEGER,
    CONSTRAINT "Themes_backgroundMediaId_fkey" FOREIGN KEY ("backgroundMediaId") REFERENCES "Media" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Themes_biblePresentationSettingsId_fkey" FOREIGN KEY ("biblePresentationSettingsId") REFERENCES "BiblePresentationSettings" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Themes" ("animationSettings", "background", "backgroundMediaId", "biblePresentationSettingsId", "createdAt", "deletedAt", "id", "name", "previewImage", "textStyle", "transitionSettings", "updatedAt", "useDefaultBibleSettings") SELECT "animationSettings", "background", "backgroundMediaId", "biblePresentationSettingsId", "createdAt", "deletedAt", "id", "name", "previewImage", "textStyle", "transitionSettings", "updatedAt", "useDefaultBibleSettings" FROM "Themes";
DROP TABLE "Themes";
ALTER TABLE "new_Themes" RENAME TO "Themes";
CREATE UNIQUE INDEX "Themes_name_key" ON "Themes"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
