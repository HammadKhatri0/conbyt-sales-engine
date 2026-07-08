-- AlterTable
ALTER TABLE "call_attempts" ADD COLUMN     "booked_date" TEXT,
ADD COLUMN     "booked_day" TEXT,
ADD COLUMN     "booked_time" TEXT,
ADD COLUMN     "main_pain_point" TEXT,
ADD COLUMN     "preferred_times" TEXT,
ADD COLUMN     "prospect_email" TEXT,
ADD COLUMN     "team_size" TEXT;
