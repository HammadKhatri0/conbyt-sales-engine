-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('QUEUED', 'CALLING', 'BOOKED', 'NOT_INTERESTED', 'VOICEMAIL', 'CALLBACK_REQUESTED', 'NO_ANSWER', 'WRONG_NUMBER', 'DO_NOT_CALL');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company" TEXT,
    "industry" TEXT,
    "opener_hook" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'QUEUED',
    "retell_call_id" TEXT,
    "timezone" TEXT,
    "campaign_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_attempts" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "retell_call_id" TEXT NOT NULL,
    "outcome" "LeadStatus",
    "transcript" TEXT,
    "summary" TEXT,
    "recording_url" TEXT,
    "duration_seconds" INTEGER,
    "disconnection_reason" TEXT,
    "raw_payload" JSONB,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "current_lead_id" TEXT,
    "gap_seconds" INTEGER NOT NULL DEFAULT 30,
    "call_start_hour" INTEGER NOT NULL DEFAULT 9,
    "call_end_hour" INTEGER NOT NULL DEFAULT 18,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_phone_key" ON "leads"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "leads_retell_call_id_key" ON "leads"("retell_call_id");

-- CreateIndex
CREATE UNIQUE INDEX "call_attempts_retell_call_id_key" ON "call_attempts"("retell_call_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
