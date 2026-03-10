-- AlterTable
ALTER TABLE "Font" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Presentation" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Schedule" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "ScheduleGroupTemplate" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "ScheduleItem" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Song" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "TagSongs" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Themes" ADD COLUMN "deletedAt" DATETIME;
