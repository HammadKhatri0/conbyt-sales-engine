-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'REPLIED';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "replied_at" TIMESTAMP(3);
