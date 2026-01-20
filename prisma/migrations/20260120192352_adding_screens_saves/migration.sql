-- CreateTable
CREATE TABLE "SelectedScreens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "screenId" INTEGER NOT NULL,
    "screenName" TEXT NOT NULL,
    "rol" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "SelectedScreens_screenId_key" ON "SelectedScreens"("screenId");
