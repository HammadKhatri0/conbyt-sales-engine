-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "brief_generated_at" TIMESTAMP(3),
ADD COLUMN     "brief_opener_hook" TEXT,
ADD COLUMN     "brief_pain_assumption" TEXT,
ADD COLUMN     "brief_personalized_pitch" TEXT,
ADD COLUMN     "brief_proof_point" TEXT;
