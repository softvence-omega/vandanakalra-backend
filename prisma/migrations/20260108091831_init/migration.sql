-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminAllowCustomPoint" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "adminAutoApprovePoint" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "adminCreateEventNotify" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "adminEventReminders" BOOLEAN NOT NULL DEFAULT true;
