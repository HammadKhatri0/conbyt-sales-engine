/*
  Warnings:

  - You are about to drop the column `calendly_access_token` on the `settings` table. All the data in the column will be lost.
  - You are about to drop the column `calendly_event_type_uri` on the `settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "settings" DROP COLUMN "calendly_access_token",
DROP COLUMN "calendly_event_type_uri",
ADD COLUMN     "calcom_api_key" TEXT,
ADD COLUMN     "calcom_event_type_id" INTEGER,
ADD COLUMN     "calcom_webhook_secret" TEXT;
