/*
  Warnings:

  - A unique constraint covering the columns `[apollo_id]` on the table `leads` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('MANUAL', 'CSV', 'SHEETS', 'HOMEPAGE', 'APOLLO');

-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING', 'ENRICHING', 'READY', 'FAILED');

-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'NEW';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "apollo_id" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "employee_count" INTEGER,
ADD COLUMN     "enrichment_status" "EnrichmentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "job_title" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "seniority_level" TEXT,
ADD COLUMN     "source" "LeadSource" NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE UNIQUE INDEX "leads_apollo_id_key" ON "leads"("apollo_id");
