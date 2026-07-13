-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retry_at" TIMESTAMP(3);
