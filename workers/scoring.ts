// workers/scoring.ts
import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { scoreLead } from "../lib/scoring";

export const scoringWorker = new Worker(
  "scoring",
  async (job) => {
    const { leadId } = job.data as { leadId: string };
    await scoreLead(leadId);
    return { success: true };
  },
  { connection: redisConnection as any, concurrency: 5 }
);

scoringWorker.on("completed", (job) => {
  console.log(`✅ Scoring completed for lead ${job.data.leadId}`);
});

scoringWorker.on("failed", (job, err) => {
  console.error(`❌ Scoring failed for lead ${job?.data.leadId}:`, err.message);
});