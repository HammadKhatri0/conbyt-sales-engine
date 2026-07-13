-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "email_before_call" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email_wait_hours" INTEGER NOT NULL DEFAULT 48;
