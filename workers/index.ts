// workers/index.ts
import "dotenv/config";
import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";

// Temporary test worker — proves the queue infrastructure works.
// Will be replaced/joined by real processors in later stages
// (enrichment, scoring, call briefs, email generation, retry checks).
const testWorker = new Worker(
  "test-queue",
  async (job) => {
    console.log(`Processing test job ${job.id}:`, job.data);
    return { processedAt: new Date().toISOString() };
  },
  { connection: redisConnection as any}
);

testWorker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

testWorker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

console.log("Worker process started, listening for jobs...");