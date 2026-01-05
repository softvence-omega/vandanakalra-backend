-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isEventReminder" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isNewEventNotify" BOOLEAN NOT NULL DEFAULT true;
