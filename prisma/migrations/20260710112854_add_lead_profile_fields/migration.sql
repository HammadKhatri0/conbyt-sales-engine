-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "callback_at" TIMESTAMP(3),
ADD COLUMN     "is_suppressed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT;
