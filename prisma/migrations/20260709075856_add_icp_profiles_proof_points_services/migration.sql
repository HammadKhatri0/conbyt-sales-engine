-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "icp_profile_id" TEXT;

-- CreateTable
CREATE TABLE "icp_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "target_industries" TEXT[],
    "employee_count_min" INTEGER,
    "employee_count_max" INTEGER,
    "geography_country" TEXT,
    "geography_region" TEXT,
    "target_job_titles" TEXT[],
    "exclude_job_titles" TEXT[],
    "positive_signals" TEXT[],
    "negative_signals" TEXT[],
    "linkedin_post_keywords" TEXT[],
    "website_keywords" TEXT[],
    "min_score_threshold" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "competitor_tools" TEXT[],
    "ideal_customer_description" TEXT,
    "linkedin_presence_description" TEXT,
    "bad_fit_description" TEXT,
    "immediate_call_trigger" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "icp_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_points" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proof_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_icp_profile_id_fkey" FOREIGN KEY ("icp_profile_id") REFERENCES "icp_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
