-- CreateTable
CREATE TABLE "Themes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "textColor" TEXT NOT NULL,
    "textSize" INTEGER NOT NULL,
    "lineHeight" REAL NOT NULL,
    "letterSpacing" REAL NOT NULL,
    "fontFamily" TEXT NOT NULL,
    "textAlign" TEXT NOT NULL,
    "previewImage" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Themes_name_key" ON "Themes"("name");
