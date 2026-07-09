-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "company_linkedin" JSONB,
ADD COLUMN     "enriched_at" TIMESTAMP(3),
ADD COLUMN     "linkedin_profile" JSONB,
ADD COLUMN     "news_summary" JSONB,
ADD COLUMN     "recent_posts" JSONB,
ADD COLUMN     "tech_stack_detected" TEXT[],
ADD COLUMN     "website" TEXT,
ADD COLUMN     "website_summary" JSONB;
