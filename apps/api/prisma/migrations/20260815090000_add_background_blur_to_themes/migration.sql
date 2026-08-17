-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
ALTER TABLE "Themes" ADD COLUMN "backgroundBlur" INTEGER NOT NULL DEFAULT 0;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
