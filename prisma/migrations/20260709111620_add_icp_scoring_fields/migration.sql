-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "final_score" DOUBLE PRECISION,
ADD COLUMN     "natural_language_score" DOUBLE PRECISION,
ADD COLUMN     "score_breakdown" JSONB,
ADD COLUMN     "scored_at" TIMESTAMP(3),
ADD COLUMN     "structured_score" DOUBLE PRECISION;
