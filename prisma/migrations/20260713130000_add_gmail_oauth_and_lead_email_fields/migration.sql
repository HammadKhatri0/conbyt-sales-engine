-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "gmail_client_id" TEXT,
ADD COLUMN     "gmail_client_secret" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "email_subject" TEXT,
ADD COLUMN     "email_body" TEXT,
ADD COLUMN     "email_generated_at" TIMESTAMP(3),
ADD COLUMN     "email_sent_at" TIMESTAMP(3);
