/*
  Warnings:

  - You are about to drop the column `bold` on the `Themes` table. All the data in the column will be lost.
  - You are about to drop the column `fontFamily` on the `Themes` table. All the data in the column will be lost.
  - You are about to drop the column `italic` on the `Themes` table. All the data in the column will be lost.
  - You are about to drop the column `letterSpacing` on the `Themes` table. All the data in the column will be lost.
  - You are about to drop the column `lineHeight` on the `Themes` table. All the data in the column will be lost.
  - You are about to drop the column `textAlign` on the `Themes` table. All the data in the column will be lost.
  - You are about to drop the column `textColor` on the `Themes` table. All the data in the column will be lost.
  - You are about to drop the column `textSize` on the `Themes` table. All the data in the column will be lost.
  - You are about to drop the column `underline` on the `Themes` table. All the data in the column will be lost.
  - Added the required column `textStyle` to the `Themes` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Themes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "backgroundMediaId" INTEGER,
    "textStyle" TEXT NOT NULL,
    "animationSettings" TEXT NOT NULL DEFAULT '{"type":"fade","duration":0.4,"delay":0,"easing":"easeInOut"}',
    "previewImage" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "useDefaultBibleSettings" BOOLEAN NOT NULL DEFAULT true,
    "biblePresentationSettingsId" INTEGER,
    CONSTRAINT "Themes_backgroundMediaId_fkey" FOREIGN KEY ("backgroundMediaId") REFERENCES "Media" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Themes_biblePresentationSettingsId_fkey" FOREIGN KEY ("biblePresentationSettingsId") REFERENCES "BiblePresentationSettings" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Themes" ("animationSettings", "background", "backgroundMediaId", "biblePresentationSettingsId", "createdAt", "id", "name", "previewImage", "updatedAt", "useDefaultBibleSettings") SELECT "animationSettings", "background", "backgroundMediaId", "biblePresentationSettingsId", "createdAt", "id", "name", "previewImage", "updatedAt", "useDefaultBibleSettings" FROM "Themes";
DROP TABLE "Themes";
ALTER TABLE "new_Themes" RENAME TO "Themes";
CREATE UNIQUE INDEX "Themes_name_key" ON "Themes"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
