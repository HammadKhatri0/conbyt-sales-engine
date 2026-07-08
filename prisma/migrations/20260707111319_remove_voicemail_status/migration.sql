/*
  Warnings:

  - The values [VOICEMAIL] on the enum `LeadStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LeadStatus_new" AS ENUM ('QUEUED', 'CALLING', 'BOOKED', 'NOT_INTERESTED', 'LINK_EMAILED', 'CALLBACK_REQUESTED', 'NO_ANSWER', 'WRONG_NUMBER', 'DO_NOT_CALL');
ALTER TABLE "public"."leads" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "leads" ALTER COLUMN "status" TYPE "LeadStatus_new" USING ("status"::text::"LeadStatus_new");
ALTER TABLE "call_attempts" ALTER COLUMN "outcome" TYPE "LeadStatus_new" USING ("outcome"::text::"LeadStatus_new");
ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";
DROP TYPE "public"."LeadStatus_old";
ALTER TABLE "leads" ALTER COLUMN "status" SET DEFAULT 'QUEUED';
COMMIT;
